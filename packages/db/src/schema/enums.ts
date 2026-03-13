import { pgEnum } from "drizzle-orm/pg-core";

// Shared enum definitions used across BookShare schema tables.
export const copyConditionEnum = pgEnum("copy_condition", [
  "new",
  "like_new",
  "good",
  "fair",
  "poor",
]);

export const copyStatusEnum = pgEnum("copy_status", [
  // Listed and ready for a new exchange.
  "available",
  // Kept by the owner but not currently being shared.
  "shelved",
  // Handed out as a community loan.
  "lent",
  // Permanently no longer in the owner's possession.
  "gone",
]);

export const shareTypeEnum = pgEnum("share_type", [
  "lend",
  "sell",
  "give_away",
]);

export const copyEventTypeEnum = pgEnum("copy_event_type", [
  "listed",
  "status_changed",
  "condition_changed",
  "lent",
  "sold",
  "returned",
  "donated",
  "given_away",
  "lost",
  "damaged",
  "note_added",
]);

export const copyLoanTypeEnum = pgEnum("copy_loan_type", [
  // Classic member-to-member borrowing.
  "lent",
  // Temporary paid lending.
  "rented",
  // Checkout-style temporary handoff.
  "checked_out",
]);

export const counterpartyTypeEnum = pgEnum("counterparty_type", [
  // Counterparty is a registered community member.
  "member",
  // Counterparty is outside the community.
  "external",
]);

export const wishStatusEnum = pgEnum("wish_status", [
  // User is still looking for the book.
  "active",
  // Wish has been satisfied by a matching copy.
  "fulfilled",
  // Wish was closed without fulfillment.
  "cancelled",
]);

export const wishClosureReasonEnum = pgEnum("wish_closure_reason", [
  // Wisher removed it manually.
  "removed_by_wisher",
  // Closed after a member-to-member loan.
  "matched_member_lent",
  // Closed after a member received the copy permanently.
  "matched_member_gone",
]);

export const bookFormatEnum = pgEnum("book_format", [
  "hardcover",
  "paperback",
  "mass_market",
]);
