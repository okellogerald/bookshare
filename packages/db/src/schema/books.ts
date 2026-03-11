import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { editions } from "./editions";
import { bookAuthors } from "./authors";
import { bookCategories } from "./categories";

// Canonical work-level book records.
export const books = pgTable("books", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  subtitle: varchar("subtitle", { length: 1000 }),
  language: varchar("language", { length: 10 }).notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Relation on books
// how many _ does one book have?
export const booksRelations = relations(books, ({ many }) => ({
  editions: many(editions),
  bookAuthors: many(bookAuthors),
  bookCategories: many(bookCategories),
}));
