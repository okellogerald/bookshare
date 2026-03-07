import type {
  BookFormat,
  CopyCondition,
  CopyStatus,
  CopyEventType,
  CopyLoanType,
  CounterpartyType,
  ShareType,
  WantStatus,
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
  notes: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ─── Copy Loan ───────────────────────────────────────────────
export interface CopyLoan {
  id: string;
  userId: string;
  copyId: string;
  loanType: CopyLoanType;
  counterpartyType: CounterpartyType;
  counterpartyUserId: string | null;
  externalName: string | null;
  externalContact: string | null;
  notes: string | null;
  startedAt: Date;
  dueAt: Date | null;
  returnedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
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
  editionId: string | null;
  notes: string | null;
  status: WantStatus;
  fulfilledAt: Date | null;
  fulfilledByCopyId: string | null;
  fulfilledByUserId: string | null;
  lastConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
