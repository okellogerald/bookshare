import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { editions } from "./editions";
import { copies } from "./copies";
import {
  copyConditionEnum,
  copySubmissionStatusEnum,
  shareTypeEnum,
} from "./enums";

export { copySubmissionStatusEnum };

// Member-submitted copy requests awaiting admin review.
export const copySubmissions = pgTable("copy_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  userEmail: varchar("user_email", { length: 255 }),
  status: copySubmissionStatusEnum("status").notNull().default("pending"),

  // Book identifiers provided by the member.
  title: varchar("title", { length: 500 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  authors: jsonb("authors").notNull().$type<string[]>(),
  isbn: varchar("isbn", { length: 20 }),
  language: varchar("language", { length: 10 }),
  bookDescriptionNotes: text("book_description_notes"),

  // Copy details provided by the member.
  condition: copyConditionEnum("condition"),
  shareType: shareTypeEnum("share_type"),
  notes: text("notes"),
  contactNote: text("contact_note"),

  // Review metadata set by staff.
  reviewerUsername: varchar("reviewer_username", { length: 255 }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),

  // Resolved catalog references set on approval.
  resolvedEditionId: uuid("resolved_edition_id").references(() => editions.id, {
    onDelete: "set null",
  }),
  resolvedCopyId: uuid("resolved_copy_id").references(() => copies.id, {
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

export const copySubmissionsRelations = relations(
  copySubmissions,
  ({ one }) => ({
    resolvedEdition: one(editions, {
      fields: [copySubmissions.resolvedEditionId],
      references: [editions.id],
    }),
    resolvedCopy: one(copies, {
      fields: [copySubmissions.resolvedCopyId],
      references: [copies.id],
    }),
  })
);
