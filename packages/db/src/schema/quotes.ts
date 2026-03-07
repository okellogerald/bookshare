import { pgTable, uuid, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { editions } from "./editions";

// User-added quotes tied to a specific edition.
export const bookQuotes = pgTable("book_quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  editionId: uuid("edition_id")
    .notNull()
    .references(() => editions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  chapter: varchar("chapter", { length: 255 }),
  addedBy: varchar("added_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bookQuotesRelations = relations(bookQuotes, ({ one }) => ({
  edition: one(editions, {
    fields: [bookQuotes.editionId],
    references: [editions.id],
  }),
}));
