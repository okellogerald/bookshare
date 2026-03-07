import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { editions } from "./editions";
import { copyEvents } from "./copy-events";
import { collectionCopies } from "./collections";
import { memberProfiles } from "./member-profiles";
import { copyImages } from "./copy-images";
import {
  copyConditionEnum,
  copyStatusEnum,
  shareTypeEnum,
} from "./enums";

export {
  copyConditionEnum,
  copyStatusEnum,
  shareTypeEnum,
};

export const copies = pgTable("copies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  borrowerUserId: varchar("borrower_user_id", { length: 255 }).references(
    () => memberProfiles.userId,
    { onDelete: "set null" }
  ),
  editionId: uuid("edition_id")
    .notNull()
    .references(() => editions.id, { onDelete: "restrict" }),
  condition: copyConditionEnum("condition").notNull(),
  status: copyStatusEnum("status").notNull().default("available"),
  notes: text("notes"),
  shareType: shareTypeEnum("share_type"),
  contactNote: text("contact_note"),
  lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const copiesRelations = relations(copies, ({ one, many }) => ({
  edition: one(editions, {
    fields: [copies.editionId],
    references: [editions.id],
  }),
  ownerProfile: one(memberProfiles, {
    fields: [copies.userId],
    references: [memberProfiles.userId],
    relationName: "ownerProfile",
  }),
  borrowerProfile: one(memberProfiles, {
    fields: [copies.borrowerUserId],
    references: [memberProfiles.userId],
    relationName: "borrowerProfile",
  }),
  events: many(copyEvents),
  collectionCopies: many(collectionCopies),
  images: many(copyImages),
}));
