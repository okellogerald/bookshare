import {
  type Database,
  categories,
  editions,
  importEntityRefs,
  memberProfiles,
  wishes,
} from "@bookshare/db";
import {
  BookFormat,
  CopyCondition,
  CopyStatus,
  ShareType,
} from "@bookshare/shared";
import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { compactString, optionalString } from "./csv";
import {
  CoverImageError,
  MAX_COVER_BYTES,
  createEditionCoverStorageFromEnv,
} from "./covers";
import { isValidIsbn, normalizeIsbn } from "./isbn";
import { parseCategorySlugs, parseDelimitedUniqueList } from "./list-parsing";
import {
  CSV_FILES,
  ENTITY_FROM_FILE,
  REQUIRED_HEADERS,
  type CsvFileName,
  type ImportEntityType,
  type ImportIssue,
  type ImportMode,
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
    wishes: [],
  };
}

function emptySummary(
  parsed: ParsedZipInput,
  options: { mode: ImportMode; replaceInventory: boolean }
): ImportSummary {
  return {
    mode: options.mode,
    replaceInventory: options.replaceInventory,
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
      "wishes.csv": { rowCount: parsed.files["wishes.csv"].rows.length },
    },
    issues: [],
  };
}

function addIssue(summary: ImportSummary, issue: ImportIssue) {
  summary.issues.push(issue);
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

function readUserEmail(row: Record<string, string>): string {
  return normalizeEmail(compactString(row.email));
}

function firstRowNumberForSourceRef(
  fileRows: Map<string, number[]>,
  sourceRef: string
): number | undefined {
  const rowNumbers = fileRows.get(sourceRef);
  if (!rowNumbers || rowNumbers.length === 0) return undefined;
  return rowNumbers[0];
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
    "wishes.csv": new Map<string, number[]>(),
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
  actorUsername: string,
  options: { mode: ImportMode; replaceInventory: boolean }
): Promise<ValidateResult> {
  const summary = emptySummary(parsed, options);
  const payloads = emptyPayloads();

  if (options.mode !== parsed.mode) {
    addIssue(summary, {
      file: "run",
      code: "mode_mismatch",
      column: "mode",
      message: `Validation mode '${options.mode}' does not match ZIP parse mode '${parsed.mode}'`,
    });
  }

  for (const fileName of CSV_FILES) {
    if (!parsed.files[fileName].present) continue;
    requiredColumnsPresent(summary, fileName, parsed.files[fileName].headers);
  }

  const actorIdentifier = compactString(actorUsername);
  const actorEmail = normalizeEmail(actorIdentifier);
  const requiresActorProfile = parsed.files["copies.csv"].rows.length > 0;
  const actor = requiresActorProfile
    ? await db.query.memberProfiles.findFirst({
        where: and(isNotNull(memberProfiles.email), eq(memberProfiles.email, actorEmail)),
      })
    : null;

  if (requiresActorProfile && !actor) {
    addIssue(summary, {
      file: "run",
      code: "unknown_actor",
      column: "actor",
      message: `Actor '${actorUsername}' was not found in member_profiles by email`,
    });
  }

  const sourceRefRows = fileSourceRefRowIndex(parsed);
  const seenSourceRefsByFile = {
    "books.csv": new Set<string>(),
    "editions.csv": new Set<string>(),
    "copies.csv": new Set<string>(),
    "wishes.csv": new Set<string>(),
  } as Record<CsvFileName, Set<string>>;

  const validBookIds = new Set<string>();
  const importedEditionIsbns = new Set<string>();
  const importedEditionsByIsbn = new Map<string, NormalizedEditionRow>();

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

    const categorySlugs = parseCategorySlugs(row.category_slugs);
    if (categorySlugs.length === 0) {
      valid = false;
      addIssue(summary, {
        file: "books.csv",
        rowNumber,
        column: "category_slugs",
        sourceRef: sourceRef || undefined,
        code: "missing_category_slugs",
        message: "category_slugs is required and must include at least one slug",
      });
    }

    if (!valid || !sourceRef) return;

    const payload: NormalizedBookRow = {
      sourceRef,
      title,
      subtitle: optionalString(row.subtitle),
      language,
      authorNames: parseDelimitedUniqueList(row.author_names),
      categorySlugs,
    };
    payloads.books.push(payload);
    validBookIds.add(sourceRef);
  });

  const allCategorySlugs = new Set<string>();
  for (const book of payloads.books) {
    for (const slug of book.categorySlugs) {
      allCategorySlugs.add(slug);
    }
  }
  if (allCategorySlugs.size > 0) {
    const existingCategories = await db
      .select({ slug: categories.slug })
      .from(categories)
      .where(inArray(categories.slug, [...allCategorySlugs]));

    const knownCategorySlugs = new Set(existingCategories.map((row) => row.slug));
    for (const book of payloads.books) {
      for (const slug of book.categorySlugs) {
        if (knownCategorySlugs.has(slug)) continue;
        addIssue(summary, {
          file: "books.csv",
          rowNumber: firstRowNumberForSourceRef(
            sourceRefRows["books.csv"],
            book.sourceRef
          ),
          column: "category_slugs",
          sourceRef: book.sourceRef,
          code: "unknown_category_slug",
          message: `category slug '${slug}' was not found in categories`,
        });
      }
    }
  }

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
    } else if (importedEditionIsbns.has(normalizedIsbn)) {
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

    importedEditionIsbns.add(normalizedIsbn);
    const payload: NormalizedEditionRow = {
      sourceRef,
      bookIdRef,
      isbn: normalizedIsbn,
      format: format as NormalizedEditionRow["format"],
      description: optionalString(row.description),
      publisher: optionalString(row.publisher),
      publishedYear: publishedYear === null ? null : publishedYear,
      pageCount: pageCount === null ? null : pageCount,
      coverImageUrl: "",
      verificationOverrideNote: optionalString(row.verification_override_note),
    };
    payloads.editions.push(payload);
    importedEditionsByIsbn.set(normalizedIsbn, payload);
  });

  if (options.mode === "catalog") {
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

  // ─── Copies/Wants user resolution ─────────────────────────────
  const userEmailsNeeded = new Set<string>();
  for (const row of parsed.files["copies.csv"].rows) {
    const email = readUserEmail(row);
    if (email) userEmailsNeeded.add(email);
  }
  for (const row of parsed.files["wishes.csv"].rows) {
    const email = readUserEmail(row);
    if (email) userEmailsNeeded.add(email);
  }

  let userRows: Array<{ userId: string; email: string }> = [];
  if (userEmailsNeeded.size > 0) {
    userRows = await db
      .select({
        userId: memberProfiles.userId,
        email: memberProfiles.email,
      })
      .from(memberProfiles)
      .where(inArray(memberProfiles.email, [...userEmailsNeeded]));
  }

  const usersByEmail = new Map<string, { userId: string; email: string }>();
  for (const row of userRows) {
    usersByEmail.set(normalizeEmail(row.email), {
      userId: row.userId,
      email: row.email,
    });
  }

  function resolveUserByEmail(email: string) {
    return usersByEmail.get(normalizeEmail(email)) ?? null;
  }

  function resolveEditionIsbnInBatchOrDb(normalizedIsbn: string): boolean {
    return (
      importedEditionsByIsbn.has(normalizedIsbn) ||
      existingEditionsByIsbn.has(normalizedIsbn)
    );
  }

  const wantsByUserBook = new Set<string>();
  const wantsCsvRowsByExistingUserBook = new Map<
    string,
    Array<{ rowNumber: number; sourceRef: string }>
  >();

  function resolveWantBookIdentity(
    normalizedEditionIsbn: string
  ): { identity: string; existingBookId: string | null } | null {
    const importedEdition = importedEditionsByIsbn.get(normalizedEditionIsbn);
    if (importedEdition) {
      return {
        identity: `import:${importedEdition.bookIdRef}`,
        existingBookId: null,
      };
    }

    const existingEdition = existingEditionsByIsbn.get(normalizedEditionIsbn);
    if (existingEdition) {
      return {
        identity: `db:${existingEdition.bookId}`,
        existingBookId: existingEdition.bookId,
      };
    }

    return null;
  }

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

    const userEmail = readUserEmail(row);
    if (!userEmail) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "email",
        sourceRef: sourceRef || undefined,
        code: "missing_user_email",
        message: "email is required",
      });
    } else if (!resolveUserByEmail(userEmail)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "email",
        sourceRef: sourceRef || undefined,
        code: "unknown_user_email",
        message: `Email '${userEmail}' was not found in member_profiles`,
      });
    }

    const editionIsbn = normalizeIsbn(row.edition_isbn ?? "");
    if (!editionIsbn) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "missing_edition_isbn",
        message: "edition_isbn is required",
      });
    } else if (!(editionIsbn.length === 10 || editionIsbn.length === 13)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "invalid_edition_isbn_length",
        message: "edition_isbn must normalize to 10 or 13 characters",
      });
    } else if (!isValidIsbn(editionIsbn)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "invalid_edition_isbn_checksum",
        message: `edition_isbn '${row.edition_isbn}' failed checksum validation`,
      });
    } else if (!resolveEditionIsbnInBatchOrDb(editionIsbn)) {
      valid = false;
      addIssue(summary, {
        file: "copies.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "unknown_edition_isbn",
        message: `edition_isbn '${editionIsbn}' does not match imported or existing editions`,
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

    if (!valid || !sourceRef || !userEmail || !editionIsbn) return;

    const resolvedUser = resolveUserByEmail(userEmail);
    if (!resolvedUser) return;

    payloads.copies.push({
      sourceRef,
      editionIsbn,
      email: userEmail,
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
  parsed.files["wishes.csv"].rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const sourceRef = compactString(row.id);
    let valid = true;

    if (!sourceRef) {
      valid = false;
      addIssue(summary, {
        file: "wishes.csv",
        rowNumber,
        column: "id",
        code: "missing_id",
        message: "id is required",
      });
    } else if (seenSourceRefsByFile["wishes.csv"].has(sourceRef)) {
      valid = false;
      addIssue(summary, {
        file: "wishes.csv",
        rowNumber,
        column: "id",
        sourceRef,
        code: "duplicate_id_in_file",
        message: `Duplicate id '${sourceRef}' in wishes.csv`,
      });
    } else {
      seenSourceRefsByFile["wishes.csv"].add(sourceRef);
    }

    const userEmail = readUserEmail(row);
    if (!userEmail) {
      valid = false;
      addIssue(summary, {
        file: "wishes.csv",
        rowNumber,
        column: "email",
        sourceRef: sourceRef || undefined,
        code: "missing_user_email",
        message: "email is required",
      });
    } else if (!resolveUserByEmail(userEmail)) {
      valid = false;
      addIssue(summary, {
        file: "wishes.csv",
        rowNumber,
        column: "email",
        sourceRef: sourceRef || undefined,
        code: "unknown_user_email",
        message: `Email '${userEmail}' was not found in member_profiles`,
      });
    }

    const editionIsbn = normalizeIsbn(row.edition_isbn ?? "");
    if (!editionIsbn) {
      valid = false;
      addIssue(summary, {
        file: "wishes.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "missing_edition_isbn",
        message: "edition_isbn is required",
      });
    } else if (!(editionIsbn.length === 10 || editionIsbn.length === 13)) {
      valid = false;
      addIssue(summary, {
        file: "wishes.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "invalid_edition_isbn_length",
        message: "edition_isbn must normalize to 10 or 13 characters",
      });
    } else if (!isValidIsbn(editionIsbn)) {
      valid = false;
      addIssue(summary, {
        file: "wishes.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "invalid_edition_isbn_checksum",
        message: `edition_isbn '${row.edition_isbn}' failed checksum validation`,
      });
    } else if (!resolveEditionIsbnInBatchOrDb(editionIsbn)) {
      valid = false;
      addIssue(summary, {
        file: "wishes.csv",
        rowNumber,
        column: "edition_isbn",
        sourceRef: sourceRef || undefined,
        code: "unknown_edition_isbn",
        message: `edition_isbn '${editionIsbn}' does not match imported or existing editions`,
      });
    }

    if (!valid || !sourceRef || !userEmail || !editionIsbn) return;

    const resolvedUser = resolveUserByEmail(userEmail);
    if (!resolvedUser) return;
    const userId = resolvedUser.userId;
    const bookIdentity = resolveWantBookIdentity(editionIsbn);
    if (!bookIdentity) return;

    const duplicateKey = `${userId}::${bookIdentity.identity}`;
    if (wantsByUserBook.has(duplicateKey)) {
      addIssue(summary, {
        file: "wishes.csv",
        rowNumber,
        sourceRef,
        code: "duplicate_want_in_batch",
        message:
          "Duplicate active wish for the same user/book combination in this batch",
      });
      return;
    }
    wantsByUserBook.add(duplicateKey);

    if (bookIdentity.existingBookId) {
      const existingBookKey = `${userId}::${bookIdentity.existingBookId}`;
      const rows = wantsCsvRowsByExistingUserBook.get(existingBookKey) ?? [];
      rows.push({ rowNumber, sourceRef });
      wantsCsvRowsByExistingUserBook.set(existingBookKey, rows);
    }

    payloads.wishes.push({
      sourceRef,
      editionIsbn,
      email: userEmail,
      userId,
      notes: optionalString(row.notes),
    });
  });

  if (!options.replaceInventory && wantsCsvRowsByExistingUserBook.size > 0) {
    const userIds = new Set<string>();
    const bookIds = new Set<string>();
    for (const key of wantsCsvRowsByExistingUserBook.keys()) {
      const [userId, bookId] = key.split("::");
      if (!userId || !bookId) continue;
      userIds.add(userId);
      bookIds.add(bookId);
    }

    if (userIds.size > 0 && bookIds.size > 0) {
      const existingActiveWants = await db
        .select({
          userId: wishes.userId,
          bookId: wishes.bookId,
        })
        .from(wishes)
        .where(
          and(
            inArray(wishes.userId, [...userIds]),
            inArray(wishes.bookId, [...bookIds]),
            eq(wishes.status, "active")
          )
        );

      for (const conflict of existingActiveWants) {
        const rows =
          wantsCsvRowsByExistingUserBook.get(
            `${conflict.userId}::${conflict.bookId}`
          ) ?? [];
        for (const row of rows) {
          addIssue(summary, {
            file: "wishes.csv",
            rowNumber: row.rowNumber,
            sourceRef: row.sourceRef,
            column: "edition_isbn",
            code: "active_want_already_exists",
            message: `Active wish already exists for user '${conflict.userId}' and book '${conflict.bookId}'`,
          });
        }
      }
    }
  }

  // Historical source_ref create-only checks
  for (const fileName of CSV_FILES) {
    if (
      options.replaceInventory &&
      (fileName === "copies.csv" || fileName === "wishes.csv")
    ) {
      continue;
    }

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

  // Cover file checks for catalog imports.
  const coversByIsbn = new Map<string, typeof parsed.covers>();
  for (const cover of parsed.covers) {
    const covers = coversByIsbn.get(cover.isbn) ?? [];
    covers.push(cover);
    coversByIsbn.set(cover.isbn, covers);
  }

  if (options.mode === "catalog") {
    const expectedEditionIsbns = new Set(payloads.editions.map((edition) => edition.isbn));

    for (const edition of payloads.editions) {
      const coverCandidates = coversByIsbn.get(edition.isbn) ?? [];
      if (coverCandidates.length === 0) {
        addIssue(summary, {
          file: "editions.csv",
          rowNumber: firstRowNumberForSourceRef(
            sourceRefRows["editions.csv"],
            edition.sourceRef
          ),
          column: "isbn",
          sourceRef: edition.sourceRef,
          code: "missing_cover_file_for_isbn",
          message: `No cover file found in covers/ for ISBN '${edition.isbn}'`,
        });
      } else if (coverCandidates.length > 1) {
        addIssue(summary, {
          file: "editions.csv",
          rowNumber: firstRowNumberForSourceRef(
            sourceRefRows["editions.csv"],
            edition.sourceRef
          ),
          column: "isbn",
          sourceRef: edition.sourceRef,
          code: "duplicate_cover_files_for_isbn",
          message: `Multiple cover files found for ISBN '${edition.isbn}': ${coverCandidates
            .map((cover) => cover.fileName)
            .join(", ")}`,
        });
      } else {
        const cover = coverCandidates[0]!;
        if (cover.bytes.length === 0) {
          addIssue(summary, {
            file: "zip",
            sourceRef: edition.sourceRef,
            code: "cover_file_empty",
            message: `Cover file '${cover.zipPath}' is empty`,
          });
        } else if (cover.bytes.length > MAX_COVER_BYTES) {
          addIssue(summary, {
            file: "zip",
            sourceRef: edition.sourceRef,
            code: "cover_too_large",
            message: `Cover file '${cover.zipPath}' is too large (${cover.bytes.length} bytes)`,
          });
        }
      }
    }

    for (const cover of parsed.covers) {
      if (expectedEditionIsbns.has(cover.isbn)) continue;
      addIssue(summary, {
        file: "zip",
        code: "orphan_cover_file",
        message: `Cover file '${cover.zipPath}' does not match any edition ISBN in editions.csv`,
      });
    }
  }

  // Upload covers only if all checks have passed.
  if (summary.issues.length === 0 && payloads.editions.length > 0) {
    let coverStorage: ReturnType<typeof createEditionCoverStorageFromEnv> | null =
      null;
    try {
      coverStorage = createEditionCoverStorageFromEnv();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Cover storage configuration is invalid";
      addIssue(summary, {
        file: "run",
        column: "covers",
        code: "cover_storage_config_missing",
        message,
      });
    }

    if (coverStorage) {
      for (const edition of payloads.editions) {
        const cover = coversByIsbn.get(edition.isbn)?.[0];
        if (!cover) continue;

        try {
          const uploaded = await coverStorage.uploadBuffer({
            isbn: edition.isbn,
            extension: cover.extension,
            bytes: cover.bytes,
          });
          edition.coverImageUrl = uploaded.publicUrl;
        } catch (error) {
          const rowNumber = firstRowNumberForSourceRef(
            sourceRefRows["editions.csv"],
            edition.sourceRef
          );
          if (error instanceof CoverImageError) {
            addIssue(summary, {
              file: "editions.csv",
              rowNumber,
              sourceRef: edition.sourceRef,
              column: "isbn",
              code: error.code,
              message: error.message,
            });
            continue;
          }

          addIssue(summary, {
            file: "editions.csv",
            rowNumber,
            sourceRef: edition.sourceRef,
            column: "isbn",
            code: "cover_upload_failed",
            message:
              error instanceof Error
                ? error.message
                : "Unexpected cover upload error",
          });
        }
      }
    }
  }

  summary.issueCount = summary.issues.length;
  summary.validRows =
    payloads.books.length +
    payloads.editions.length +
    payloads.copies.length +
    payloads.wishes.length;

  const status = summary.issueCount === 0 ? "validated" : "invalid";

  return {
    status,
    summary,
    payloads,
  };
}
