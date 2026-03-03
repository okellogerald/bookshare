import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { books } from "./books";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  parentId: uuid("parent_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryHierarchy",
  }),
  children: many(categories, { relationName: "categoryHierarchy" }),
  bookCategories: many(bookCategories),
}));

export const bookCategories = pgTable(
  "book_categories",
  {
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.bookId, table.categoryId] })]
);

export const bookCategoriesRelations = relations(
  bookCategories,
  ({ one }) => ({
    book: one(books, {
      fields: [bookCategories.bookId],
      references: [books.id],
    }),
    category: one(categories, {
      fields: [bookCategories.categoryId],
      references: [categories.id],
    }),
  })
);
