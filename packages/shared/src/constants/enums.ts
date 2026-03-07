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
  AVAILABLE: "available",
  RESERVED: "reserved",
  LENT: "lent",
  RENTED: "rented",
  CHECKED_OUT: "checked_out",
  SOLD: "sold",
  DONATED: "donated",
  GIVEN_AWAY: "given_away",
  LOST: "lost",
  DAMAGED: "damaged",
} as const;

export type CopyStatus = (typeof CopyStatus)[keyof typeof CopyStatus];

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
  ACTIVE: "active",
  FULFILLED: "fulfilled",
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
