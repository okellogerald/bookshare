import {
  type Database,
  editions,
  importEntityRefs,
  memberProfiles,
} from "@bookshare/db";
import {
  BookFormat,
  CopyCondition,
  CopyStatus,
  ShareType,
} from "@bookshare/shared";
import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
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

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isEmailIdentifier(value: string): boolean {
  return value.includes("@");
}

function readUserIdentifier(row: Record<string, string>): string {
  return compactString(row.email ?? row.username);
}

function userIdentifierColumn(row: Record<string, string>): "email" | "username" {
  return row.email !== undefined ? "email" : "username";
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
      const sourceRef = compactString(row.id);
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

  const actorIdentifier = compactString(actorUsername);
  const actorEmail = normalizeEmail(actorIdentifier);
  const actor = await db.query.memberProfiles.findFirst({
    where: or(
      and(isNotNull(memberProfiles.email), eq(memberProfiles.email, actorEmail)),
      eq(memberProfiles.username, actorIdentifier)
    ),
  });
  if (!actor) {
    addIssue(summary, {
      file: "run",
      code: "unknown_actor",
      column: "actor",
      message: `Actor '${actorUsername}' was not found in member_profiles (checked email and username)`,
    });
  }

  const sourceRefRows = fileSourceRefRowIndex(parsed);
  const seenSourceRefsByFile = {
    "books.csv": new Set<string>(),
    "editions.csv": new Set<string>(),
    "copies.csv": new Set<string>(),
    "wants.csv": new Set<string>(),
  } as Record<CsvFileName, Set<string>>;

  const validBookIds = new Set<string>();
  const seenEditionIsbns = new Set<string>();

  // ─── Books ─────────────────────────────────────────────────────
  parsed.files["books.csv"].rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const sourceRef = compactString(row.id);
    let valid = true;

    if (!sourceRef) {
      valid = false;
      addIssue(summary, {
        file: "books.csv",
        rowNumber,
        column: "id",
        code: "missing_id",
        message: "id is required",
      });
    } else if (seenSourceRefsByFile["books.csv"].has(sourceRef)) {
      valid = false;
      addIssue(summary, {
        file: "books.csv",
        rowNumber,
        column: "id",
        sourceRef,
        code: "duplicate_id_in_file",
        message: `Duplicate id '${sourceRef}' in books.csv`,
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
    validBookIds.add(sourceRef);
  });

  // ─── Editions ──────────────────────────────────────────────────
  parsed.files["editions.csv"].rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const sourceRef = compactString(row.id);
    let valid = true;

    if (!sourceRef) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "id",
        code: "missing_id",
        message: "id is required",
      });
    } else if (seenSourceRefsByFile["editions.csv"].has(sourceRef)) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "id",
        sourceRef,
        code: "duplicate_id_in_file",
        message: `Duplicate id '${sourceRef}' in editions.csv`,
      });
    } else {
      seenSourceRefsByFile["editions.csv"].add(sourceRef);
    }

    const bookIdRef = compactString(row.book_id);
    if (!bookIdRef) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "book_id",
        sourceRef: sourceRef || undefined,
        code: "missing_book_id",
        message: "book_id is required",
      });
    } else if (!validBookIds.has(bookIdRef)) {
      valid = false;
      addIssue(summary, {
        file: "editions.csv",
        rowNumber,
        column: "book_id",
        sourceRef: sourceRef || undefined,
        code: "unknown_book_id",
        message: `book_id '${bookIdRef}' does not match a valid books.id`,
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
    } else if (seenEditionIsbns.has(normalizedIsbn)) {
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

    if (!valid || !sourceRef || !bookIdRef || !normalizedIsbn) return;

    seenEditionIsbns.add(normalizedIsbn);
    const payload: NormalizedEditionRow = {
      sourceRef,
      bookIdRef,
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
    const covered = payloads.editions.some(
      (edition) => edition.bookIdRef === book.sourceRef
    );
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

  const userIdentifiersNeeded = new Set<string>();
  for (const row of parsed.files["copies.csv"].rows) {
    const identifier = readUserIdentifier(row);
    if (identifier) userIdentifiersNeeded.add(identifier);
  }
  for (const row of parsed.files["wants.csv"].rows) {
    const identifier = readUserIdentifier(row);
    if (identifier) userIdentifiersNeeded.add(identifier);
  }

  const emailIdentifiers = [...userIdentifiersNeeded]
    .filter((value) => isEmailIdentifier(value))
    .map(normalizeEmail);
  const usernameIdentifiers = [...userIdentifiersNeeded].filter(
    (value) => !isEmailIdentifier(value)
  );

  let userRows: Array<{ userId: string; username: string; email: string | null }> = [];
  if (emailIdentifiers.length > 0 || usernameIdentifiers.length > 0) {
    const whereClause =
      emailIdentifiers.length > 0 && usernameIdentifiers.length > 0
        ? or(
            and(
              isNotNull(memberProfiles.email),
              inArray(memberProfiles.email, emailIdentifiers)
            ),
            inArray(memberProfiles.username, usernameIdentifiers)
          )
        : emailIdentifiers.length > 0
          ? and(
              isNotNull(memberProfiles.email),
              inArray(memberProfiles.email, emailIdentifiers)
            )
          : inArray(memberProfiles.username, usernameIdentifiers);

    userRows = await db
      .select({
        userId: memberProfiles.userId,
        username: memberProfiles.username,
        email: memberProfiles.email,
      })
      .from(memberProfiles)
      .where(whereClause);
  }

  const usersByEmail = new Map<string, { userId: string; email: string }>();
  const usersByUsername = new Map<string, { userId: string; username: string }>();
  for (const row of userRows) {
    usersByUsername.set(row.username, {
      userId: row.userId,
      username: row.username,
    });
    if (row.email) {
      usersByEmail.set(normalizeEmail(row.email), {
        userId: row.userId,
        email: row.email,
      });
    }
  }

  function resolveUser(identifier: string) {
    if (isEmailIdentifier(identifier)) {
      return usersByEmail.get(normalizeEmail(identifier)) ?? null;
    }
    return usersByUsername.get(identifier) ?? null;
  }

  const wantsByUserEdition = new Set<string>();

  // ─── Copies ────────────────────────────────────────────────────
  parsed.files["copies.csv"].rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const sourceRef = compactString(row.id);
    let valid = true;

    if (!sourceRef) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "id",
        code: "missing_id",
        message: "id is required",
      });
    } else if (seenSourceRefsByFile["copies.csv"].has(sourceRef)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "id",
        sourceRef,
        code: "duplicate_id_in_file",
        message: `Duplicate id '${sourceRef}' in copies.csv`,
      });
    } else {
      seenSourceRefsByFile["copies.csv"].add(sourceRef);
    }

    const userIdentifier = readUserIdentifier(row);
    const identifierColumn = userIdentifierColumn(row);
    if (!userIdentifier) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: identifierColumn,
        sourceRef: sourceRef || undefined,
        code: "missing_user_identifier",
        message: `${identifierColumn} is required`,
      });
    } else if (!resolveUser(userIdentifier)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: identifierColumn,
        sourceRef: sourceRef || undefined,
        code: "unknown_user_identifier",
        message: `Identifier '${userIdentifier}' was not found in member_profiles (checked email and username)`,
      });
    }

    const editionIdRef = compactString(row.edition_id);
    if (!editionIdRef) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "edition_id",
        sourceRef: sourceRef || undefined,
        code: "missing_edition_id",
        message: "edition_id is required",
      });
    } else if (!seenSourceRefsByFile["editions.csv"].has(editionIdRef)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "edition_id",
        sourceRef: sourceRef || undefined,
        code: "unknown_edition_id",
        message: `edition_id '${editionIdRef}' does not match a valid editions.id`,
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

    if (!valid || !sourceRef || !userIdentifier || !editionIdRef) return;

    const resolvedUser = resolveUser(userIdentifier);
    if (!resolvedUser) return;

    payloads.copies.push({
      sourceRef,
      editionIdRef,
      username: userIdentifier,
      userId: resolvedUser.userId,
      condition: condition as NormalizedCopyRow["condition"],
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
    const sourceRef = compactString(row.id);
    let valid = true;

    if (!sourceRef) {
      valid = false;
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        column: "id",
        code: "missing_id",
        message: "id is required",
      });
    } else if (seenSourceRefsByFile["wants.csv"].has(sourceRef)) {
      valid = false;
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        column: "id",
        sourceRef,
        code: "duplicate_id_in_file",
        message: `Duplicate id '${sourceRef}' in wants.csv`,
      });
    } else {
      seenSourceRefsByFile["wants.csv"].add(sourceRef);
    }

    const userIdentifier = readUserIdentifier(row);
    const identifierColumn = userIdentifierColumn(row);
    if (!userIdentifier) {
      valid = false;
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        column: identifierColumn,
        sourceRef: sourceRef || undefined,
        code: "missing_user_identifier",
        message: `${identifierColumn} is required`,
      });
    } else if (!resolveUser(userIdentifier)) {
      valid = false;
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        column: identifierColumn,
        sourceRef: sourceRef || undefined,
        code: "unknown_user_identifier",
        message: `Identifier '${userIdentifier}' was not found in member_profiles (checked email and username)`,
      });
    }

    const editionIdRef = compactString(row.edition_id);
    if (!editionIdRef) {
      valid = false;
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        column: "edition_id",
        sourceRef: sourceRef || undefined,
        code: "missing_edition_id",
        message: "edition_id is required",
      });
    } else if (!seenSourceRefsByFile["editions.csv"].has(editionIdRef)) {
      valid = false;
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        column: "edition_id",
        sourceRef: sourceRef || undefined,
        code: "unknown_edition_id",
        message: `edition_id '${editionIdRef}' does not match a valid editions.id`,
      });
    }

    if (!valid || !sourceRef || !userIdentifier || !editionIdRef) return;

    const resolvedUser = resolveUser(userIdentifier);
    if (!resolvedUser) return;
    const userId = resolvedUser.userId;
    const duplicateKey = `${userId}::${editionIdRef}`;
    if (wantsByUserEdition.has(duplicateKey)) {
      addIssue(summary, {
        file: "wants.csv",
        rowNumber,
        sourceRef,
        code: "duplicate_want_in_batch",
        message:
          "Duplicate active want for the same user/edition combination in this batch",
      });
      return;
    }
    wantsByUserEdition.add(duplicateKey);

    payloads.wants.push({
      sourceRef,
      editionIdRef,
      username: userIdentifier,
      userId,
      notes: optionalString(row.notes),
    });
  });

  // Historical id (source_ref storage key) create-only checks
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
          column: "id",
          sourceRef,
          code: "id_already_imported",
          message: `id '${sourceRef}' was already imported for '${entityType}'`,
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
