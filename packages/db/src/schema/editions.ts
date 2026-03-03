import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { books } from "./books";
import { bookQuotes } from "./quotes";
import { copies } from "./copies";
import { bookFormatEnum } from "./enums";

export { bookFormatEnum };

export const editions = pgTable("editions", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  isbn: varchar("isbn", { length: 20 }).unique(),
  format: bookFormatEnum("format").notNull(),
  publisher: varchar("publisher", { length: 500 }),
  publishedYear: integer("published_year"),
  pageCount: integer("page_count"),
  coverImageUrl: varchar("cover_image_url", { length: 1000 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const editionsRelations = relations(editions, ({ one, many }) => ({
  book: one(books, {
    fields: [editions.bookId],
    references: [books.id],
  }),
  quotes: many(bookQuotes),
  copies: many(copies),
}));
