import {
  type Database,
  editions,
  importEntityRefs,
  memberProfiles,
  wants,
} from "@booktrack/db";
import {
  AcquisitionType,
  BookFormat,
  CopyCondition,
  CopyStatus,
  ShareType,
} from "@booktrack/shared";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { compactString, optionalString } from "./csv";
import { isValidIsbn, normalizeIsbn } from "./isbn";
import {
  CSV_FILES,
  ENTITY_FROM_FILE,
  REQUIRED_HEADERS,
  type CsvFileName,
  type ImportEntityType,
  type ImportIssue,
  type ImportSummary,
  type NormalizedBookRow,
  type NormalizedCopyRow,
  type NormalizedEditionRow,
  type NormalizedPayloadSet,
  type NormalizedWantRow,
  type ParsedZipInput,
  type ValidateResult,
} from "./types";

const BOOK_FORMAT_VALUES = new Set<string>(Object.values(BookFormat));
const COPY_CONDITION_VALUES = new Set<string>(Object.values(CopyCondition));
const ACQUISITION_TYPE_VALUES = new Set<string>(Object.values(AcquisitionType));
const SHARE_TYPE_VALUES = new Set<string>(Object.values(ShareType));
const COPY_STATUS_VALUES = new Set<string>(Object.values(CopyStatus));

function emptyPayloads(): NormalizedPayloadSet {
  return {
    books: [],
    editions: [],
    copies: [],
    wants: [],
  };
}

function emptySummary(parsed: ParsedZipInput): ImportSummary {
  return {
    totalRows: CSV_FILES.reduce(
      (count, fileName) => count + parsed.files[fileName].rows.length,
      0
    ),
    validRows: 0,
    issueCount: 0,
    files: {
      "books.csv": { rowCount: parsed.files["books.csv"].rows.length },
      "editions.csv": { rowCount: parsed.files["editions.csv"].rows.length },
      "copies.csv": { rowCount: parsed.files["copies.csv"].rows.length },
      "wants.csv": { rowCount: parsed.files["wants.csv"].rows.length },
    },
    issues: [],
  };
}

function addIssue(summary: ImportSummary, issue: ImportIssue) {
  summary.issues.push(issue);
}

function parseList(value: string | undefined): string[] {
  const next = compactString(value);
  if (!next) return [];

  const segments =
    next.includes(";")
      ? next.split(";")
      : next.includes("|")
        ? next.split("|")
        : next.split(",");

  const deduped = new Set<string>();
  for (const part of segments) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    deduped.add(trimmed);
  }

  return [...deduped];
}

function parseInteger(
  value: string | undefined,
  context: { min?: number; max?: number } = {}
): number | null {
  const trimmed = compactString(value);
  if (!trimmed) return null;

  if (!/^-?\d+$/.test(trimmed)) return Number.NaN;
  const parsed = Number.parseInt(trimmed, 10);

  if (context.min !== undefined && parsed < context.min) return Number.NaN;
  if (context.max !== undefined && parsed > context.max) return Number.NaN;

  return parsed;
}

function parseIsoDate(value: string | undefined): string | null {
  const trimmed = compactString(value);
  if (!trimmed) return null;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function existingRefsByEntity(
  db: Database,
  entityType: ImportEntityType,
  sourceRefs: string[]
) {
  if (sourceRefs.length === 0) return new Set<string>();

  const rows = await db
    .select({ sourceRef: importEntityRefs.sourceRef })
    .from(importEntityRefs)
    .where(
      and(
        eq(importEntityRefs.entityType, entityType),
        inArray(importEntityRefs.sourceRef, sourceRefs)
      )
    );

  return new Set(rows.map((row) => row.sourceRef));
}

function requiredColumnsPresent(
  summary: ImportSummary,
  fileName: CsvFileName,
  headers: string[]
) {
  const present = new Set(headers.map((header) => header.trim()));

  for (const required of REQUIRED_HEADERS[fileName]) {
    if (!present.has(required)) {
      addIssue(summary, {
        file: fileName,
        column: required,
        code: "missing_required_column",
        message: `Missing required column '${required}'`,
      });
    }
  }
}

interface ExistingEditionEntry {
  id: string;
  isbn: string;
  bookId: string;
}

async function loadExistingEditionsByIsbn(db: Database) {
  const rows = await db
    .select({
      id: editions.id,
      isbn: editions.isbn,
      bookId: editions.bookId,
    })
    .from(editions)
    .where(isNotNull(editions.isbn));

  const byNormalizedIsbn = new Map<string, ExistingEditionEntry>();
  for (const row of rows) {
    const normalized = normalizeIsbn(row.isbn!);
    if (!normalized) continue;
    byNormalizedIsbn.set(normalized, {
      id: row.id,
      isbn: row.isbn!,
      bookId: row.bookId,
    });
  }

  return byNormalizedIsbn;
}

function fileSourceRefRowIndex(
  parsed: ParsedZipInput
): Record<CsvFileName, Map<string, number[]>> {
  const out = {
    "books.csv": new Map<string, number[]>(),
    "editions.csv": new Map<string, number[]>(),
    "copies.csv": new Map<string, number[]>(),
    "wants.csv": new Map<string, number[]>(),
  } as Record<CsvFileName, Map<string, number[]>>;

  for (const fileName of CSV_FILES) {
    parsed.files[fileName].rows.forEach((row, index) => {
      const sourceRef = compactString(row.source_ref);
      if (!sourceRef) return;
      const rowsForRef = out[fileName].get(sourceRef) ?? [];
      rowsForRef.push(index + 2);
      out[fileName].set(sourceRef, rowsForRef);
    });
  }

  return out;
}

export async function validateParsedInput(
  db: Database,
  parsed: ParsedZipInput,
  actorUsername: string
): Promise<ValidateResult> {
  const summary = emptySummary(parsed);
  const payloads = emptyPayloads();

  for (const fileName of CSV_FILES) {
    requiredColumnsPresent(summary, fileName, parsed.files[fileName].headers);
  }

  const actor = await db.query.memberProfiles.findFirst({
    where: eq(memberProfiles.username, actorUsername),
  });
  if (!actor) {
    addIssue(summary, {
      file: "run",
      code: "unknown_actor",
      column: "actor",
      message: `Actor username '${actorUsername}' was not found in member_profiles`,
    });
  }

  const sourceRefRows = fileSourceRefRowIndex(parsed);
  const seenSourceRefsByFile = {
    "books.csv": new Set<string>(),
    "editions.csv": new Set<string>(),
    "copies.csv": new Set<string>(),
    "wants.csv": new Set<string>(),
  } as Record<CsvFileName, Set<string>>;

  const validBookRefs = new Set<string>();
  const editionBookRefByIsbn = new Map<string, string>();

  // ─── Books ─────────────────────────────────────────────────────
  parsed.files["books.csv"].rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const sourceRef = compactString(row.source_ref);
    let valid = true;

    if (!sourceRef) {
      valid = false;
      addIssue(summary, {
        file: "books.csv",
        rowNumber,
        column: "source_ref",
        code: "missing_source_ref",
        message: "source_ref is required",
      });
    } else if (seenSourceRefsByFile["books.csv"].has(sourceRef)) {
      valid = false;
      addIssue(summary, {
        file: "books.csv",
        rowNumber,
        column: "source_ref",
        sourceRef,
        code: "duplicate_source_ref_in_file",
        message: `Duplicate source_ref '${sourceRef}' in books.csv`,
      });
    } else {
      seenSourceRefsByFile["books.csv"].add(sourceRef);
    }

    const title = compactString(row.title);
    if (!title) {
      valid = false;
      addIssue(summary, {
        file: "books.csv",
        rowNumber,
        column: "title",
        sourceRef: sourceRef || undefined,
        code: "missing_title",
        message: "title is required",
      });
    }

    const language = compactString(row.language) || "en";
    if (language.length > 10) {
      valid = false;
      addIssue(summary, {
        file: "books.csv",
        rowNumber,
        column: "language",
        sourceRef: sourceRef || undefined,
        code: "invalid_language",
        message: "language must be <= 10 characters",
      });
    }

    if (!valid || !sourceRef) return;

    const payload: NormalizedBookRow = {
      sourceRef,
      title,
      subtitle: optionalString(row.subtitle),
      description: optionalString(row.description),
      language,
      authorNames: parseList(row.author_names),
    };
    payloads.books.push(payload);
    validBookRefs.add(sourceRef);
  });

  // ─── Editions ──────────────────────────────────────────────────
  parsed.files["editions.csv"].rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const sourceRef = compactString(row.source_ref);
    let valid = true;

    if (!sourceRef) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "source_ref",
        code: "missing_source_ref",
        message: "source_ref is required",
      });
    } else if (seenSourceRefsByFile["editions.csv"].has(sourceRef)) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "source_ref",
        sourceRef,
        code: "duplicate_source_ref_in_file",
        message: `Duplicate source_ref '${sourceRef}' in editions.csv`,
      });
    } else {
      seenSourceRefsByFile["editions.csv"].add(sourceRef);
    }

    const bookRef = compactString(row.book_ref);
    if (!bookRef) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "book_ref",
        sourceRef: sourceRef || undefined,
        code: "missing_book_ref",
        message: "book_ref is required",
      });
    } else if (!validBookRefs.has(bookRef)) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "book_ref",
        sourceRef: sourceRef || undefined,
        code: "unknown_book_ref",
        message: `book_ref '${bookRef}' does not match a valid book source_ref`,
      });
    }

    const normalizedIsbn = normalizeIsbn(row.isbn ?? "");
    if (!normalizedIsbn) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "isbn",
        sourceRef: sourceRef || undefined,
        code: "missing_isbn",
        message: "isbn is required",
      });
    } else if (!(normalizedIsbn.length === 10 || normalizedIsbn.length === 13)) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "isbn",
        sourceRef: sourceRef || undefined,
        code: "invalid_isbn_length",
        message: "isbn must normalize to 10 or 13 characters",
      });
    } else if (!isValidIsbn(normalizedIsbn)) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "isbn",
        sourceRef: sourceRef || undefined,
        code: "invalid_isbn_checksum",
        message: `ISBN '${row.isbn}' failed checksum validation`,
      });
    } else if (editionBookRefByIsbn.has(normalizedIsbn)) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "isbn",
        sourceRef: sourceRef || undefined,
        code: "duplicate_isbn_in_file",
        message: `Duplicate ISBN '${normalizedIsbn}' in editions.csv`,
      });
    }

    const format = compactString(row.format);
    if (!BOOK_FORMAT_VALUES.has(format)) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "format",
        sourceRef: sourceRef || undefined,
        code: "invalid_format",
        message: `format must be one of: ${[...BOOK_FORMAT_VALUES].join(", ")}`,
      });
    }

    const publishedYear = parseInteger(row.published_year, { min: 0, max: 9999 });
    if (Number.isNaN(publishedYear)) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "published_year",
        sourceRef: sourceRef || undefined,
        code: "invalid_published_year",
        message: "published_year must be an integer between 0 and 9999",
      });
    }

    const pageCount = parseInteger(row.page_count, { min: 1, max: 100000 });
    if (Number.isNaN(pageCount)) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "page_count",
        sourceRef: sourceRef || undefined,
        code: "invalid_page_count",
        message: "page_count must be a positive integer",
      });
    }

    if (!valid || !sourceRef || !bookRef || !normalizedIsbn) return;

    editionBookRefByIsbn.set(normalizedIsbn, bookRef);
    const payload: NormalizedEditionRow = {
      sourceRef,
      bookRef,
      isbn: normalizedIsbn,
      format: format as NormalizedEditionRow["format"],
      publisher: optionalString(row.publisher),
      publishedYear: publishedYear === null ? null : publishedYear,
      pageCount: pageCount === null ? null : pageCount,
      verificationOverrideNote: optionalString(row.verification_override_note),
    };
    payloads.editions.push(payload);
  });

  for (const book of payloads.books) {
    const covered = payloads.editions.some((edition) => edition.bookRef === book.sourceRef);
    if (!covered) {
      addIssue(summary, {
        file: "books.csv",
        sourceRef: book.sourceRef,
        code: "book_missing_isbn_backed_edition",
        message: `Book '${book.sourceRef}' does not have a resolvable edition row with ISBN`,
      });
    }
  }

  const existingEditionsByIsbn = await loadExistingEditionsByIsbn(db);
  for (const edition of payloads.editions) {
    if (existingEditionsByIsbn.has(edition.isbn)) {
      addIssue(summary, {
        file: "editions.csv",
        sourceRef: edition.sourceRef,
        column: "isbn",
        code: "edition_isbn_exists",
        message: `Edition ISBN '${edition.isbn}' already exists`,
      });
    }
  }

  const usernamesNeeded = new Set<string>();
  for (const row of parsed.files["copies.csv"].rows) {
    const username = compactString(row.username);
    if (username) usernamesNeeded.add(username);
  }
  for (const row of parsed.files["wants.csv"].rows) {
    const username = compactString(row.username);
    if (username) usernamesNeeded.add(username);
  }

  const userRows =
    usernamesNeeded.size === 0
      ? []
      : await db
          .select({
            userId: memberProfiles.userId,
            username: memberProfiles.username,
          })
          .from(memberProfiles)
          .where(inArray(memberProfiles.username, [...usernamesNeeded]));

  const usersByUsername = new Map(
    userRows.map((row) => [row.username, { userId: row.userId, username: row.username }])
  );

  const wantsBookIdentity = new Set<string>();
  const wantsAgainstExistingBooks = new Set<string>();

  // ─── Copies ────────────────────────────────────────────────────
  parsed.files["copies.csv"].rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const sourceRef = compactString(row.source_ref);
    let valid = true;

    if (!sourceRef) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "source_ref",
        code: "missing_source_ref",
        message: "source_ref is required",
      });
    } else if (seenSourceRefsByFile["copies.csv"].has(sourceRef)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "source_ref",
        sourceRef,
        code: "duplicate_source_ref_in_file",
        message: `Duplicate source_ref '${sourceRef}' in copies.csv`,
      });
    } else {
      seenSourceRefsByFile["copies.csv"].add(sourceRef);
    }

    const username = compactString(row.username);
    if (!username) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "username",
        sourceRef: sourceRef || undefined,
        code: "missing_username",
        message: "username is required",
      });
    } else if (!usersByUsername.has(username)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "username",
        sourceRef: sourceRef || undefined,
        code: "unknown_username",
        message: `username '${username}' was not found in member_profiles`,
      });
    }

    const normalizedIsbn = normalizeIsbn(row.edition_isbn ?? "");
    if (!normalizedIsbn) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "missing_edition_isbn",
        message: "edition_isbn is required",
      });
    } else if (!isValidIsbn(normalizedIsbn)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "invalid_edition_isbn",
        message: `edition_isbn '${row.edition_isbn}' failed checksum validation`,
      });
    } else if (
      !editionBookRefByIsbn.has(normalizedIsbn) &&
      !existingEditionsByIsbn.has(normalizedIsbn)
    ) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "unknown_edition_isbn",
        message: `edition_isbn '${normalizedIsbn}' does not match imported or existing editions`,
      });
    }

    const condition = compactString(row.condition);
    if (!COPY_CONDITION_VALUES.has(condition)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "condition",
        sourceRef: sourceRef || undefined,
        code: "invalid_condition",
        message: `condition must be one of: ${[...COPY_CONDITION_VALUES].join(", ")}`,
      });
    }

    const acquisitionType = compactString(row.acquisition_type);
    if (!ACQUISITION_TYPE_VALUES.has(acquisitionType)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "acquisition_type",
        sourceRef: sourceRef || undefined,
        code: "invalid_acquisition_type",
        message: `acquisition_type must be one of: ${[...ACQUISITION_TYPE_VALUES].join(", ")}`,
      });
    }

    const shareType = compactString(row.share_type);
    if (shareType && !SHARE_TYPE_VALUES.has(shareType)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "share_type",
        sourceRef: sourceRef || undefined,
        code: "invalid_share_type",
        message: `share_type must be one of: ${[...SHARE_TYPE_VALUES].join(", ")}`,
      });
    }

    const status = compactString(row.status) || "available";
    if (!COPY_STATUS_VALUES.has(status)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "status",
        sourceRef: sourceRef || undefined,
        code: "invalid_status",
        message: `status must be one of: ${[...COPY_STATUS_VALUES].join(", ")}`,
      });
    }

    const acquisitionDateRaw = compactString(row.acquisition_date);
    const acquisitionDate =
      acquisitionDateRaw.length === 0 ? null : parseIsoDate(acquisitionDateRaw);
    if (acquisitionDateRaw && acquisitionDate === null) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "acquisition_date",
        sourceRef: sourceRef || undefined,
        code: "invalid_acquisition_date",
        message: "acquisition_date must be parseable as a date",
      });
    }

    if (!valid || !sourceRef || !username || !normalizedIsbn) return;

    payloads.copies.push({
      sourceRef,
      editionIsbn: normalizedIsbn,
      username,
      userId: usersByUsername.get(username)!.userId,
      condition: condition as NormalizedCopyRow["condition"],
      acquisitionType: acquisitionType as NormalizedCopyRow["acquisitionType"],
      acquisitionDate,
      location: optionalString(row.location),
      notes: optionalString(row.notes),
      shareType: shareType
        ? (shareType as NormalizedCopyRow["shareType"])
        : null,
      contactNote: optionalString(row.contact_note),
      status: status as NormalizedCopyRow["status"],
    });
  });

  // ─── Wants ─────────────────────────────────────────────────────
  parsed.files["wants.csv"].rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const sourceRef = compactString(row.source_ref);
    let valid = true;

    if (!sourceRef) {
      valid = false;
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        column: "source_ref",
        code: "missing_source_ref",
        message: "source_ref is required",
      });
    } else if (seenSourceRefsByFile["wants.csv"].has(sourceRef)) {
      valid = false;
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        column: "source_ref",
        sourceRef,
        code: "duplicate_source_ref_in_file",
        message: `Duplicate source_ref '${sourceRef}' in wants.csv`,
      });
    } else {
      seenSourceRefsByFile["wants.csv"].add(sourceRef);
    }

    const username = compactString(row.username);
    if (!username) {
      valid = false;
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        column: "username",
        sourceRef: sourceRef || undefined,
        code: "missing_username",
        message: "username is required",
      });
    } else if (!usersByUsername.has(username)) {
      valid = false;
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        column: "username",
        sourceRef: sourceRef || undefined,
        code: "unknown_username",
        message: `username '${username}' was not found in member_profiles`,
      });
    }

    const normalizedIsbn = normalizeIsbn(row.edition_isbn ?? "");
    if (!normalizedIsbn) {
      valid = false;
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "missing_edition_isbn",
        message: "edition_isbn is required",
      });
    } else if (!isValidIsbn(normalizedIsbn)) {
      valid = false;
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "invalid_edition_isbn",
        message: `edition_isbn '${row.edition_isbn}' failed checksum validation`,
      });
    } else if (
      !editionBookRefByIsbn.has(normalizedIsbn) &&
      !existingEditionsByIsbn.has(normalizedIsbn)
    ) {
      valid = false;
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "unknown_edition_isbn",
        message: `edition_isbn '${normalizedIsbn}' does not match imported or existing editions`,
      });
    }

    if (!valid || !sourceRef || !username || !normalizedIsbn) return;

    const userId = usersByUsername.get(username)!.userId;
    const bookIdentity = editionBookRefByIsbn.has(normalizedIsbn)
      ? `new:${editionBookRefByIsbn.get(normalizedIsbn)!}`
      : `db:${existingEditionsByIsbn.get(normalizedIsbn)!.bookId}`;

    const duplicateKey = `${userId}::${bookIdentity}`;
    if (wantsBookIdentity.has(duplicateKey)) {
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        sourceRef,
        code: "duplicate_want_in_batch",
        message:
          "Duplicate active want for the same user/book combination in this batch",
      });
      return;
    }
    wantsBookIdentity.add(duplicateKey);

    if (bookIdentity.startsWith("db:")) {
      wantsAgainstExistingBooks.add(duplicateKey);
    }

    payloads.wants.push({
      sourceRef,
      editionIsbn: normalizedIsbn,
      username,
      userId,
      notes: optionalString(row.notes),
    });
  });

  // Existing active want conflicts (create-only)
  if (wantsAgainstExistingBooks.size > 0) {
    const userIds = new Set<string>();
    const bookIds = new Set<string>();
    for (const pair of wantsAgainstExistingBooks) {
      const [userId, bookIdentity] = pair.split("::");
      if (!userId || !bookIdentity) continue;
      userIds.add(userId);
      bookIds.add(bookIdentity.replace(/^db:/, ""));
    }

    if (userIds.size > 0 && bookIds.size > 0) {
      const existingActiveWants = await db
        .select({ userId: wants.userId, bookId: wants.bookId })
        .from(wants)
        .where(
          and(
            inArray(wants.userId, [...userIds]),
            inArray(wants.bookId, [...bookIds]),
            eq(wants.status, "active")
          )
        );

      const existingPairs = new Set(
        existingActiveWants.map((row) => `${row.userId}::db:${row.bookId}`)
      );

      payloads.wants = payloads.wants.filter((want) => {
        const existingEdition = existingEditionsByIsbn.get(want.editionIsbn);
        if (!existingEdition) return true;

        const key = `${want.userId}::db:${existingEdition.bookId}`;
        if (!existingPairs.has(key)) return true;

        addIssue(summary, {
          file: "wants.csv",
          sourceRef: want.sourceRef,
          code: "active_want_exists",
          message:
            "An active want already exists in the database for this user/book pair",
        });
        return false;
      });
    }
  }

  // Historical source_ref create-only checks
  for (const fileName of CSV_FILES) {
    const entityType = ENTITY_FROM_FILE[fileName];
    const sourceRefs = [...seenSourceRefsByFile[fileName]];
    if (sourceRefs.length === 0) continue;

    const existingRefs = await existingRefsByEntity(db, entityType, sourceRefs);
    for (const sourceRef of existingRefs) {
      const rowNumbers = sourceRefRows[fileName].get(sourceRef) ?? [];
      for (const rowNumber of rowNumbers) {
        addIssue(summary, {
          file: fileName,
          rowNumber,
          column: "source_ref",
          sourceRef,
          code: "source_ref_already_imported",
          message: `source_ref '${sourceRef}' was already imported for '${entityType}'`,
        });
      }
    }
  }

  summary.issueCount = summary.issues.length;
  summary.validRows =
    payloads.books.length +
    payloads.editions.length +
    payloads.copies.length +
    payloads.wants.length;

  const status = summary.issueCount === 0 ? "validated" : "invalid";

  return {
    status,
    summary,
    payloads,
  };
}
