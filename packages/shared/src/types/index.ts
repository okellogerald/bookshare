import type {
  BookFormat,
  CopyCondition,
  CopyStatus,
  AcquisitionType,
  CopyEventType,
  ShareType,
} from "../constants/enums";

// ─── Book ────────────────────────────────────────────────────
export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Author ──────────────────────────────────────────────────
export interface Author {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Edition ─────────────────────────────────────────────────
export interface Edition {
  id: string;
  bookId: string;
  isbn: string | null;
  format: BookFormat;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  coverImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Book Quote ──────────────────────────────────────────────
export interface BookQuote {
  id: string;
  editionId: string;
  text: string;
  chapter: string | null;
  addedBy: string;
  createdAt: Date;
}

// ─── Copy ────────────────────────────────────────────────────
export interface Copy {
  id: string;
  userId: string;
  editionId: string;
  condition: CopyCondition;
  status: CopyStatus;
  acquisitionType: AcquisitionType;
  acquisitionDate: Date | null;
  location: string | null;
  notes: string | null;
  shareType: ShareType | null;
  contactNote: string | null;
  lastConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Copy Event ──────────────────────────────────────────────
export interface CopyEvent {
  id: string;
  userId: string;
  copyId: string;
  eventType: CopyEventType;
  fromStatus: CopyStatus | null;
  toStatus: CopyStatus | null;
  performedBy: string;
  amount: string | null;
  currency: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ─── Category ────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  createdAt: Date;
}

// ─── Collection ──────────────────────────────────────────────
export interface Collection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Want ────────────────────────────────────────────────────
export interface Want {
  id: string;
  userId: string;
  bookId: string;
  notes: string | null;
  lastConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
