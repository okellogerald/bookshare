// ─── Book Format ──────────────────────────────────────────────
export const BookFormat = {
  HARDCOVER: "hardcover",
  PAPERBACK: "paperback",
  MASS_MARKET: "mass_market",
  EBOOK: "ebook",
  AUDIOBOOK: "audiobook",
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
  // Temporarily promised to someone but not yet handed over.
  RESERVED: "reserved",
  // Handed out as a community loan.
  LENT: "lent",
  // Handed out for a paid/temporary rental.
  RENTED: "rented",
  // Checked out in a loan-like flow.
  CHECKED_OUT: "checked_out",
  // Permanently sold by the owner.
  SOLD: "sold",
  // Permanently donated to an organization.
  DONATED: "donated",
  // Permanently given away to an individual.
  GIVEN_AWAY: "given_away",
  // Owner no longer has the copy due to loss.
  LOST: "lost",
  // Copy is damaged and not in normal circulation.
  DAMAGED: "damaged",
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
  ACQUIRED: "acquired",
  STATUS_CHANGE: "status_change",
  CONDITION_CHANGE: "condition_change",
  LENT: "lent",
  SOLD: "sold",
  RENTED: "rented",
  RETURNED: "returned",
  DONATED: "donated",
  GIVEN_AWAY: "given_away",
  LOST: "lost",
  DAMAGED: "damaged",
  NOTE_ADDED: "note_added",
} as const;

export type CopyEventType =
  (typeof CopyEventType)[keyof typeof CopyEventType];

// ─── Want Status ─────────────────────────────────────────────
export const WantStatus = {
  // User is still looking for the book.
  ACTIVE: "active",
  // Want has been satisfied.
  FULFILLED: "fulfilled",
  // User closed the want without fulfillment.
  CANCELLED: "cancelled",
} as const;

export type WantStatus = (typeof WantStatus)[keyof typeof WantStatus];

// ─── Zitadel Roles ───────────────────────────────────────────
export const UserRole = {
  OWNER: "owner",
  MANAGER: "manager",
  STAFF: "staff",
  VIEWER: "viewer",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
