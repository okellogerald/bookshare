// ─── Book Format ──────────────────────────────────────────────
export const BookFormat = {
  HARDCOVER: "hardcover",
  PAPERBACK: "paperback",
  MASS_MARKET: "mass_market",
} as const;

export type BookFormat = (typeof BookFormat)[keyof typeof BookFormat];

// ─── Share Type ─────────────────────────────────────────────
export const ShareType = {
  LEND: "lend",
  SELL: "sell",
  GIVE_AWAY: "give_away",
} as const;

export type ShareType = (typeof ShareType)[keyof typeof ShareType];

// ─── Copy Condition ──────────────────────────────────────────
export const CopyCondition = {
  NEW: "new",
  LIKE_NEW: "like_new",
  GOOD: "good",
  FAIR: "fair",
  POOR: "poor",
} as const;

export type CopyCondition = (typeof CopyCondition)[keyof typeof CopyCondition];

// ─── Copy Status ─────────────────────────────────────────────
export const CopyStatus = {
  // Listed and ready for a new exchange.
  AVAILABLE: "available",
  // Kept by the owner but not currently being shared.
  SHELVED: "shelved",
  // Handed out as a community loan.
  LENT: "lent",
  // Permanently no longer in the owner's possession.
  GONE: "gone",
} as const;

export type CopyStatus = (typeof CopyStatus)[keyof typeof CopyStatus];

// ─── Copy Loan Type ─────────────────────────────────────────
export const CopyLoanType = {
  // Classic member-to-member borrowing.
  LENT: "lent",
  // Temporary paid lending.
  RENTED: "rented",
  // Checkout-style temporary handoff.
  CHECKED_OUT: "checked_out",
} as const;

export type CopyLoanType =
  (typeof CopyLoanType)[keyof typeof CopyLoanType];

// ─── Counterparty Type ──────────────────────────────────────
export const CounterpartyType = {
  // Counterparty is a registered community member.
  MEMBER: "member",
  // Counterparty is outside the community.
  EXTERNAL: "external",
} as const;

export type CounterpartyType =
  (typeof CounterpartyType)[keyof typeof CounterpartyType];

// ─── Copy Event Type ─────────────────────────────────────────
export const CopyEventType = {
  LISTED: "listed",
  STATUS_CHANGED: "status_changed",
  CONDITION_CHANGED: "condition_changed",
  LENT: "lent",
  SOLD: "sold",
  RETURNED: "returned",
  DONATED: "donated",
  GIVEN_AWAY: "given_away",
  LOST: "lost",
  DAMAGED: "damaged",
  NOTE_ADDED: "note_added",
} as const;

export type CopyEventType =
  (typeof CopyEventType)[keyof typeof CopyEventType];

// ─── Gone Reason ─────────────────────────────────────────────
export const GoneReason = {
  SOLD: "sold",
  DONATED: "donated",
  GIVEN_AWAY: "given_away",
  LOST: "lost",
} as const;

export type GoneReason = (typeof GoneReason)[keyof typeof GoneReason];

// ─── Wish Status ─────────────────────────────────────────────
export const WishStatus = {
  // User is still looking for the book.
  ACTIVE: "active",
  // Wish has been satisfied.
  FULFILLED: "fulfilled",
  // User closed the wish without fulfillment.
  CANCELLED: "cancelled",
} as const;

export type WishStatus = (typeof WishStatus)[keyof typeof WishStatus];

// ─── Wish Closure Reason ─────────────────────────────────────
export const WishClosureReason = {
  // Wisher removed it manually.
  REMOVED_BY_WISHER: "removed_by_wisher",
  // Closed after a member-to-member loan.
  MATCHED_MEMBER_LENT: "matched_member_lent",
  // Closed after a member received the copy permanently.
  MATCHED_MEMBER_GONE: "matched_member_gone",
  // Cancelled by an admin.
  ARCHIVED_BY_ADMIN: "archived_by_admin",
} as const;

export type WishClosureReason =
  (typeof WishClosureReason)[keyof typeof WishClosureReason];

// Temporary alias while downstream modules finish the rename.
export const WantStatus = WishStatus;
export type WantStatus = WishStatus;
export const WantClosureReason = WishClosureReason;
export type WantClosureReason = WishClosureReason;

// ─── Notification Type ───────────────────────────────────────
export const NotificationType = {
  COPY_AVAILABLE: "copy_available",
  WISH_FULFILLED_IMMEDIATELY: "wish_fulfilled_immediately",
  WISH_MATCHES_COPY: "wish_matches_copy",
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

// ─── Workflow Topic ──────────────────────────────────────────
export const WorkflowTopic = {
  COPY_CREATED: "copy.created",
  COPY_STATUS_CHANGED: "copy.status_changed",
  WISH_CREATED: "wish.created",
} as const;

export type WorkflowTopic = (typeof WorkflowTopic)[keyof typeof WorkflowTopic];

// ─── Platform Roles ──────────────────────────────────────────
export const PlatformRole = {
  USER: "user",
  PLATFORM_ADMIN: "platform_admin",
  PLATFORM_STAFF: "platform_staff",
} as const;

export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

export const AdminConsoleRole = [
  PlatformRole.PLATFORM_ADMIN,
  PlatformRole.PLATFORM_STAFF,
] as const;

export type AdminConsoleRole =
  (typeof AdminConsoleRole)[number];

export function isAdminConsoleRole(role: string): role is AdminConsoleRole {
  return (AdminConsoleRole as readonly string[]).includes(role);
}

// Temporary alias while callers finish the rename.
export const UserRole = PlatformRole;
export type UserRole = PlatformRole;
