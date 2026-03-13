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
import { wishClosureReasonEnum, wishStatusEnum } from "./enums";
import { memberProfiles } from "./member-profiles";

// User wishlist entries for books they are seeking.
export const wishes = pgTable(
  "wishes",
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
    status: wishStatusEnum("status").notNull().default("active"),
    closureReason: wishClosureReasonEnum("closure_reason"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
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
    uniqueIndex("wishes_user_book_active_unique")
      .on(t.userId, t.bookId)
      .where(sql`${t.status} = 'active'`),
  ]
);

export const wishesRelations = relations(wishes, ({ one }) => ({
  book: one(books, {
    fields: [wishes.bookId],
    references: [books.id],
  }),
  edition: one(editions, {
    fields: [wishes.editionId],
    references: [editions.id],
  }),
  userProfile: one(memberProfiles, {
    fields: [wishes.userId],
    references: [memberProfiles.userId],
  }),
  fulfilledByCopy: one(copies, {
    fields: [wishes.fulfilledByCopyId],
    references: [copies.id],
  }),
}));

// Temporary aliases while the rest of the codebase finishes the rename.
export const wants = wishes;
export const wantsRelations = wishesRelations;
