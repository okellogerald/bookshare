import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { books } from "./books";

// Thema subject classification for books.
// Hierarchy, breadcrumbs, and display names live in the Thema JSON;
// the database only stores code assignments.
export const categories = pgTable("categories", {
  themaCode: varchar("thema_code", { length: 20 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  bookCategories: many(bookCategories),
}));

// Many-to-many bridge between books and categories.
export const bookCategories = pgTable(
  "book_categories",
  {
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    themaCode: varchar("thema_code", { length: 20 })
      .notNull()
      .references(() => categories.themaCode, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.bookId, table.themaCode] })]
);

export const bookCategoriesRelations = relations(
  bookCategories,
  ({ one }) => ({
    book: one(books, {
      fields: [bookCategories.bookId],
      references: [books.id],
    }),
    category: one(categories, {
      fields: [bookCategories.themaCode],
      references: [categories.themaCode],
    }),
  })
);
