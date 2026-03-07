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
  // Temporarily promised to someone but not yet handed over.
  "reserved",
  // Handed out as a community loan.
  "lent",
  // Handed out for a paid/temporary rental.
  "rented",
  // Checked out in a loan-like flow (kept separate for future rules).
  "checked_out",
  // Permanently sold by the owner.
  "sold",
  // Permanently donated to an organization.
  "donated",
  // Permanently given away to an individual.
  "given_away",
  // Owner no longer has the copy due to loss.
  "lost",
  // Copy is damaged and not in normal circulation.
  "damaged",
]);

export const shareTypeEnum = pgEnum("share_type", [
  "lend",
  "sell",
  "give_away",
]);

export const copyEventTypeEnum = pgEnum("copy_event_type", [
  "acquired",
  "status_change",
  "condition_change",
  "lent",
  "sold",
  "rented",
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

export const wantStatusEnum = pgEnum("want_status", [
  // User is still looking for the book.
  "active",
  // Want has been satisfied by a matching copy.
  "fulfilled",
  // Want was closed without fulfillment.
  "cancelled",
]);

export const bookFormatEnum = pgEnum("book_format", [
  "hardcover",
  "paperback",
  "mass_market",
  "ebook",
  "audiobook",
]);
