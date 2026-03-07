import type { BookFormat, CopyCondition, CopyStatus, ShareType } from "@bookshare/shared";

export const CSV_FILES = [
  "books.csv",
  "editions.csv",
  "copies.csv",
  "wants.csv",
] as const;

export type CsvFileName = (typeof CSV_FILES)[number];
export type ImportEntityType = "books" | "editions" | "copies" | "wants";
export type RunStatus = "invalid" | "validated" | "committed";

export const ENTITY_FROM_FILE: Record<CsvFileName, ImportEntityType> = {
  "books.csv": "books",
  "editions.csv": "editions",
  "copies.csv": "copies",
  "wants.csv": "wants",
};

export const REQUIRED_HEADERS: Record<CsvFileName, readonly string[]> = {
  "books.csv": [
    "id",
    "title",
    "subtitle",
    "description",
    "language",
    "author_names",
  ],
  "editions.csv": [
    "id",
    "book_id",
    "isbn",
    "format",
    "publisher",
    "published_year",
    "page_count",
    "verification_override_note",
  ],
  "copies.csv": [
    "id",
    "edition_id",
    "username",
    "condition",
    "notes",
    "share_type",
    "contact_note",
    "status",
  ],
  "wants.csv": ["id", "edition_id", "username", "notes"],
};

export interface ImportIssue {
  file: CsvFileName | "zip" | "run";
  rowNumber?: number;
  column?: string;
  sourceRef?: string;
  code: string;
  message: string;
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  issueCount: number;
  files: Record<CsvFileName, { rowCount: number }>;
  issues: ImportIssue[];
}

export interface ParsedCsvFile {
  fileName: CsvFileName;
  headers: string[];
  rows: Array<Record<string, string>>;
}

export interface ParsedZipInput {
  zipName: string;
  sha256: string;
  files: Record<CsvFileName, ParsedCsvFile>;
}

export interface NormalizedBookRow {
  sourceRef: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  language: string;
  authorNames: string[];
}

export interface NormalizedEditionRow {
  sourceRef: string;
  bookIdRef: string;
  isbn: string;
  format: BookFormat;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  verificationOverrideNote: string | null;
}

export interface NormalizedCopyRow {
  sourceRef: string;
  editionIdRef: string;
  username: string;
  userId: string;
  condition: CopyCondition;
  notes: string | null;
  shareType: ShareType | null;
  contactNote: string | null;
  status: CopyStatus;
}

export interface NormalizedWantRow {
  sourceRef: string;
  editionIdRef: string;
  username: string;
  userId: string;
  notes: string | null;
}

export interface NormalizedPayloadSet {
  books: NormalizedBookRow[];
  editions: NormalizedEditionRow[];
  copies: NormalizedCopyRow[];
  wants: NormalizedWantRow[];
}

export interface ValidateResult {
  status: RunStatus;
  summary: ImportSummary;
  payloads: NormalizedPayloadSet;
}
