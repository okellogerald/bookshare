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

// User-owned copy listings and their current lifecycle state.
export const copies = pgTable("copies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
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
  events: many(copyEvents),
  collectionCopies: many(collectionCopies),
  images: many(copyImages),
}));
