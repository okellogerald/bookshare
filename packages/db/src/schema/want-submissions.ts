import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { books } from "./books";
import { wishes } from "./wishes";
import { wantSubmissionStatusEnum } from "./enums";

export { wantSubmissionStatusEnum };

// Member-submitted want requests awaiting admin review.
export const wantSubmissions = pgTable("want_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  userEmail: varchar("user_email", { length: 255 }),
  status: wantSubmissionStatusEnum("status").notNull().default("pending"),

  // Book identifiers provided by the member.
  title: varchar("title", { length: 500 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  authors: jsonb("authors").notNull().$type<string[]>(),
  isbn: varchar("isbn", { length: 20 }),
  language: varchar("language", { length: 10 }),
  bookDescriptionNotes: text("book_description_notes"),

  // Want detail provided by the member.
  wantNotes: text("want_notes"),

  // Review metadata set by staff.
  reviewerUsername: varchar("reviewer_username", { length: 255 }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),

  // Resolved catalog references set on approval.
  resolvedBookId: uuid("resolved_book_id").references(() => books.id, {
    onDelete: "set null",
  }),
  resolvedWishId: uuid("resolved_wish_id").references(() => wishes.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const wantSubmissionsRelations = relations(
  wantSubmissions,
  ({ one }) => ({
    resolvedBook: one(books, {
      fields: [wantSubmissions.resolvedBookId],
      references: [books.id],
    }),
    resolvedWish: one(wishes, {
      fields: [wantSubmissions.resolvedWishId],
      references: [wishes.id],
    }),
  })
);
