import type { BookFormat, CopyCondition, CopyStatus, ShareType } from "@bookshare/shared";
import type { CoverExtension } from "./covers";

export const CSV_FILES = [
  "books.csv",
  "editions.csv",
  "copies.csv",
  "wishes.csv",
] as const;

export type CsvFileName = (typeof CSV_FILES)[number];
export type ImportEntityType = "books" | "editions" | "copies" | "wishes";
export type RunStatus = "invalid" | "validated" | "committed";
export type ImportMode = "catalog" | "inventory_only";

export const ENTITY_FROM_FILE: Record<CsvFileName, ImportEntityType> = {
  "books.csv": "books",
  "editions.csv": "editions",
  "copies.csv": "copies",
  "wishes.csv": "wishes",
};

export const REQUIRED_HEADERS: Record<CsvFileName, readonly string[]> = {
  "books.csv": [
    "id",
    "title",
    "subtitle",
    "language",
    "author_names",
    "thema_codes",
  ],
  "editions.csv": [
    "id",
    "book_id",
    "isbn",
    "format",
    "description",
    "publisher",
    "published_year",
    "page_count",
    "verification_override_note",
  ],
  "copies.csv": [
    "id",
    "edition_isbn",
    "email",
    "condition",
    "notes",
    "share_type",
    "contact_note",
    "status",
  ],
  "wishes.csv": ["id", "edition_isbn", "email", "notes"],
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
  mode: ImportMode;
  replaceInventory: boolean;
  totalRows: number;
  validRows: number;
  issueCount: number;
  files: Record<CsvFileName, { rowCount: number }>;
  issues: ImportIssue[];
}

export interface ParsedCsvFile {
  fileName: CsvFileName;
  present: boolean;
  headers: string[];
  rows: Array<Record<string, string>>;
}

export interface ParsedCoverFile {
  zipPath: string;
  fileName: string;
  isbn: string;
  extension: CoverExtension;
  bytes: Buffer;
}

export interface ParsedZipInput {
  zipName: string;
  sha256: string;
  mode: ImportMode;
  files: Record<CsvFileName, ParsedCsvFile>;
  covers: ParsedCoverFile[];
}

export interface NormalizedBookRow {
  sourceRef: string;
  title: string;
  subtitle: string | null;
  language: string;
  authorNames: string[];
  themaCodes: string[];
}

export interface NormalizedEditionRow {
  sourceRef: string;
  bookIdRef: string;
  isbn: string;
  format: BookFormat;
  description: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  coverImageUrl: string;
  verificationOverrideNote: string | null;
}

export interface NormalizedCopyRow {
  sourceRef: string;
  editionIsbn: string;
  email: string;
  userId: string;
  condition: CopyCondition;
  notes: string | null;
  shareType: ShareType | null;
  contactNote: string | null;
  status: CopyStatus;
}

export interface NormalizedWishRow {
  sourceRef: string;
  editionIsbn: string;
  email: string;
  userId: string;
  notes: string | null;
}

export interface NormalizedPayloadSet {
  books: NormalizedBookRow[];
  editions: NormalizedEditionRow[];
  copies: NormalizedCopyRow[];
  wishes: NormalizedWishRow[];
}

export interface ValidateResult {
  status: RunStatus;
  summary: ImportSummary;
  payloads: NormalizedPayloadSet;
}

export type NormalizedWantRow = NormalizedWishRow;
