import {
  NotificationType,
  WorkflowTopic,
} from "../constants/enums";
import type {
  BookFormat,
  CopyCondition,
  CopyStatus,
  CopyEventType,
  CopyLoanType,
  CounterpartyType,
  ShareType,
  WishStatus,
} from "../constants/enums";

// ─── Book ────────────────────────────────────────────────────
export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
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
  description: string | null;
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

// ─── Wish ────────────────────────────────────────────────────
export interface Wish {
  id: string;
  userId: string;
  bookId: string;
  editionId: string | null;
  notes: string | null;
  status: WishStatus;
  fulfilledAt: Date | null;
  fulfilledByCopyId: string | null;
  fulfilledByUserId: string | null;
  lastConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Notification ───────────────────────────────────────────
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read: boolean;
  linkTo: string | null;
  createdAt: Date;
}

export interface CopyCreatedWorkflowEvent {
  copyId: string;
  userId: string;
}

export interface CopyStatusChangedWorkflowEvent {
  copyId: string;
  userId: string;
  fromStatus: CopyStatus;
  toStatus: CopyStatus;
}

export interface WishCreatedWorkflowEvent {
  wishId: string;
  userId: string;
}

export interface WorkflowEventPayloadMap {
  [WorkflowTopic.COPY_CREATED]: CopyCreatedWorkflowEvent;
  [WorkflowTopic.COPY_STATUS_CHANGED]: CopyStatusChangedWorkflowEvent;
  [WorkflowTopic.WISH_CREATED]: WishCreatedWorkflowEvent;
}

export interface WorkflowEventEnvelope<TTopic extends WorkflowTopic = WorkflowTopic> {
  topic: TTopic;
  data: WorkflowEventPayloadMap[TTopic];
}

export interface CopyAvailableNotificationMetadata extends Record<string, unknown> {
  bookId: string;
  editionId: string;
  copyId: string;
  wishId: string;
  listerUserId: string;
}

export interface WishFulfilledImmediatelyNotificationMetadata
  extends Record<string, unknown> {
  bookId: string;
  wishId: string;
  copyIds: string[];
}

export interface WishMatchesCopyNotificationMetadata extends Record<string, unknown> {
  bookId: string;
  copyId: string;
  wishId: string;
  wisherUserId: string;
}

export interface NotificationMetadataMap {
  [NotificationType.COPY_AVAILABLE]: CopyAvailableNotificationMetadata;
  [NotificationType.WISH_FULFILLED_IMMEDIATELY]: WishFulfilledImmediatelyNotificationMetadata;
  [NotificationType.WISH_MATCHES_COPY]: WishMatchesCopyNotificationMetadata;
}

// Temporary alias while downstream modules finish the rename.
export type Want = Wish;
