import { pgEnum } from "drizzle-orm/pg-core";

export const copyConditionEnum = pgEnum("copy_condition", [
  "new",
  "like_new",
  "good",
  "fair",
  "poor",
]);

export const copyStatusEnum = pgEnum("copy_status", [
  "available",
  "reserved",
  "lent",
  "rented",
  "checked_out",
  "sold",
  "donated",
  "given_away",
  "lost",
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

export const wantStatusEnum = pgEnum("want_status", [
  "active",
  "fulfilled",
  "cancelled",
]);

export const bookFormatEnum = pgEnum("book_format", [
  "hardcover",
  "paperback",
  "mass_market",
  "ebook",
  "audiobook",
]);
