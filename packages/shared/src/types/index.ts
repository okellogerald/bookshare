import {
  NotificationType,
  WorkflowTopic,
} from "../constants/enums";
import type {
  BookFormat,
  BookstoreInviteStatus,
  BookstoreMembershipRole,
  BookstoreMembershipStatus,
  BookstoreProposalStatus,
  BookstoreStatus,
  CopyCondition,
  CopyStatus,
  CopyEventType,
  CopyLoanType,
  CounterpartyType,
  OrganizationType,
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
  themaCode: string;
  name: string;
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

// ─── Organization / Bookstores ───────────────────────────────
export interface Organization {
  id: string;
  type: OrganizationType;
  status: BookstoreStatus;
  name: string;
  websiteUrl: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  address: string | null;
  contactNote: string | null;
  createdBy: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: BookstoreMembershipRole;
  status: BookstoreMembershipStatus;
  suspendedAt: Date | null;
  createdAt: Date;
}

export interface OrganizationInvite {
  id: string;
  organizationId: string;
  invitedEmail: string;
  invitedBy: string;
  acceptedBy: string | null;
  status: BookstoreInviteStatus;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookstoreProposal {
  id: string;
  organizationId: string;
  wishId: string;
  createdBy: string;
  message: string | null;
  status: BookstoreProposalStatus;
  withdrawnAt: Date | null;
  expiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookstoreSummary {
  id: string;
  name: string;
  status: BookstoreStatus;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookstoreDetail extends BookstoreSummary {
  whatsapp: string | null;
  instagram: string | null;
  address: string | null;
  contactNote: string | null;
  createdBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  ownerActivatedAt: string | null;
  myRole: BookstoreMembershipRole;
  canManageMembers: boolean;
  memberCount: number;
  recentProposalCount: number;
}

export interface BookstoreBootstrapMembership {
  organizationId: string;
  role: BookstoreMembershipRole;
  joinedAt: string;
  organization: BookstoreSummary;
}

export interface BookstorePendingInvite {
  id: string;
  invitedEmail: string;
  createdAt: string;
  organization: BookstoreSummary;
}

export interface BookstoresBootstrapResponse {
  memberships: BookstoreBootstrapMembership[];
  pendingInvites: BookstorePendingInvite[];
  user: {
    id: string;
    email: string | null;
    emailVerified: boolean;
  };
}

export interface BookstoreProposalSummary {
  id: string;
  organizationId: string;
  wishId: string;
  message: string | null;
  status: BookstoreProposalStatus;
  createdAt: string;
  updatedAt: string;
  withdrawnAt: string | null;
}

export interface BookstoreWantEdition {
  id: string;
  isbn: string | null;
  format: BookFormat;
  description: string | null;
  coverImageUrl: string | null;
}

export interface BookstoreWanterSummary {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  location: string | null;
  avatarUrl: string | null;
}

export interface BookstoreWantBookSummary {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  primaryIsbn: string | null;
  coverImageUrl: string | null;
  editions: BookstoreWantEdition[];
}

export interface BookstoreWantRow {
  id: string;
  userId: string;
  notes: string | null;
  createdAt: string;
  lastConfirmedAt: string | null;
  latestActivityAt: string;
  book: BookstoreWantBookSummary;
  wanter: BookstoreWanterSummary;
  activeProposal: Pick<
    BookstoreProposalSummary,
    "id" | "status" | "message" | "createdAt"
  > | null;
}

export interface BookstoreMemberRecord {
  userId: string;
  role: BookstoreMembershipRole;
  status: BookstoreMembershipStatus;
  suspendedAt: string | null;
  joinedAt: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  location: string | null;
  avatarUrl: string | null;
  displayName: string;
}

export interface BookstoreMembersResponse {
  members: BookstoreMemberRecord[];
  pendingInvites: Array<{
    id: string;
    invitedEmail: string;
    createdAt: string;
  }>;
}

export interface BookstorePublicProfile {
  id: string;
  name: string;
  status: BookstoreStatus;
  websiteUrl: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  address: string | null;
  contactNote: string | null;
}

export interface AdminBookstoreSummary extends BookstoreSummary {
  memberCount: number;
  ownerCount: number;
  ownerNames: string[];
  recentProposalCount: number;
}

export interface AdminBookstoreCreateResult {
  bookstore: AdminBookstoreDetail;
  owner: {
    userId: string;
    email: string;
    createdIdentity: boolean;
  };
  emailSent: boolean;
}

export interface AdminBookstoreResendOwnerEmailResult {
  emailSent: boolean;
}

export interface AdminBookstoreDetail
  extends Omit<BookstoreDetail, "myRole" | "canManageMembers"> {
  members: Array<{
    userId: string;
    role: BookstoreMembershipRole;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    displayName: string;
    joinedAt: string;
  }>;
  memberCount: number;
  ownerCount: number;
  pendingInviteCount: number;
  recentProposalCount: number;
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

export interface BookstoreProposalNotificationMetadata
  extends Record<string, unknown> {
  proposalId: string;
  organizationId: string;
  organizationName: string;
  wishId: string;
  book: NotificationBookSnapshot;
  wish: NotificationWishSnapshot;
  proposalMessage: string | null;
}

export interface NotificationMetadataMap {
  [NotificationType.COPY_AVAILABLE]: CopyAvailableNotificationMetadata;
  [NotificationType.WISH_FULFILLED_IMMEDIATELY]: WishFulfilledImmediatelyNotificationMetadata;
  [NotificationType.WISH_MATCHES_COPY]: WishMatchesCopyNotificationMetadata;
  [NotificationType.BOOKSTORE_PROPOSAL]: BookstoreProposalNotificationMetadata;
}

// Temporary alias while downstream modules finish the rename.
export type Want = Wish;
