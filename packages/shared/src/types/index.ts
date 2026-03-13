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
  WishClosureReason,
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
  notes: string | null;
  status: WishStatus;
  closureReason: WishClosureReason | null;
  closedAt: Date | null;
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

export interface NotificationBookSnapshot extends Record<string, unknown> {
  bookId: string;
  title: string;
  subtitle: string | null;
  authors: string[];
}

export interface NotificationEditionSnapshot extends Record<string, unknown> {
  editionId: string;
  isbn: string | null;
  format: BookFormat;
  publisher: string | null;
  publishedYear: number | null;
}

export interface NotificationMemberSnapshot extends Record<string, unknown> {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  location: string | null;
  contactNotes: string | null;
  avatarUrl: string | null;
  profilePath: string | null;
}

export interface NotificationCopySnapshot extends Record<string, unknown> {
  copyId: string;
  condition: CopyCondition;
  shareType: ShareType | null;
  notes: string | null;
  contactNote: string | null;
  edition: NotificationEditionSnapshot;
}

export interface NotificationWishSnapshot extends Record<string, unknown> {
  wishId: string;
  notes: string | null;
}

export interface CopyAvailableNotificationMetadata extends Record<string, unknown> {
  book: NotificationBookSnapshot;
  wish: NotificationWishSnapshot;
  copy: NotificationCopySnapshot;
  owner: NotificationMemberSnapshot;
  bookPath: string;
}

export interface WishFulfilledImmediatelyNotificationMetadata
  extends Record<string, unknown> {
  book: NotificationBookSnapshot;
  wish: NotificationWishSnapshot;
  matches: Array<{
    owner: NotificationMemberSnapshot;
    copy: NotificationCopySnapshot;
  }>;
  bookPath: string;
}

export interface WishMatchesCopyNotificationMetadata extends Record<string, unknown> {
  book: NotificationBookSnapshot;
  wish: NotificationWishSnapshot;
  wisher: NotificationMemberSnapshot;
  matchingCopies: NotificationCopySnapshot[];
  bookPath: string;
}

export interface NotificationMetadataMap {
  [NotificationType.COPY_AVAILABLE]: CopyAvailableNotificationMetadata;
  [NotificationType.WISH_FULFILLED_IMMEDIATELY]: WishFulfilledImmediatelyNotificationMetadata;
  [NotificationType.WISH_MATCHES_COPY]: WishMatchesCopyNotificationMetadata;
}

// Temporary alias while downstream modules finish the rename.
export type Want = Wish;
