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
import {
  copyConditionEnum,
  copyStatusEnum,
  acquisitionTypeEnum,
  shareTypeEnum,
} from "./enums";

export {
  copyConditionEnum,
  copyStatusEnum,
  acquisitionTypeEnum,
  shareTypeEnum,
};

export const copies = pgTable("copies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  editionId: uuid("edition_id")
    .notNull()
    .references(() => editions.id, { onDelete: "restrict" }),
  condition: copyConditionEnum("condition").notNull(),
  status: copyStatusEnum("status").notNull().default("available"),
  acquisitionType: acquisitionTypeEnum("acquisition_type").notNull(),
  acquisitionDate: timestamp("acquisition_date", { withTimezone: true }),
  location: varchar("location", { length: 500 }),
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
  events: many(copyEvents),
  collectionCopies: many(collectionCopies),
}));
