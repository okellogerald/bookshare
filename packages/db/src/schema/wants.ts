import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { books } from "./books";

export const wants = pgTable(
  "wants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "restrict" }),
    notes: text("notes"),
    lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("wants_user_book_unique").on(t.userId, t.bookId)]
);

export const wantsRelations = relations(wants, ({ one }) => ({
  book: one(books, {
    fields: [wants.bookId],
    references: [books.id],
  }),
}));
