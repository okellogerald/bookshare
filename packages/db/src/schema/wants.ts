import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { books } from "./books";
import { copies } from "./copies";
import { editions } from "./editions";
import { wantStatusEnum } from "./enums";
import { memberProfiles } from "./member-profiles";

// User want-list entries for books they are seeking.
export const wants = pgTable(
  "wants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "restrict" }),
    editionId: uuid("edition_id").references(() => editions.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    status: wantStatusEnum("status").notNull().default("active"),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    fulfilledByCopyId: uuid("fulfilled_by_copy_id").references(
      () => copies.id,
      { onDelete: "set null" }
    ),
    fulfilledByUserId: varchar("fulfilled_by_user_id", { length: 255 }),
    lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("wants_user_book_active_unique")
      .on(t.userId, t.bookId)
      .where(sql`${t.status} = 'active'`),
  ]
);

export const wantsRelations = relations(wants, ({ one }) => ({
  book: one(books, {
    fields: [wants.bookId],
    references: [books.id],
  }),
  edition: one(editions, {
    fields: [wants.editionId],
    references: [editions.id],
  }),
  userProfile: one(memberProfiles, {
    fields: [wants.userId],
    references: [memberProfiles.userId],
  }),
  fulfilledByCopy: one(copies, {
    fields: [wants.fulfilledByCopyId],
    references: [copies.id],
  }),
}));
