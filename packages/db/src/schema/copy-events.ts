import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { copies } from "./copies";
import { copyStatusEnum, copyEventTypeEnum } from "./enums";

export { copyEventTypeEnum };

export const copyEvents = pgTable("copy_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  copyId: uuid("copy_id")
    .notNull()
    .references(() => copies.id, { onDelete: "cascade" }),
  eventType: copyEventTypeEnum("event_type").notNull(),
  fromStatus: copyStatusEnum("from_status"),
  toStatus: copyStatusEnum("to_status"),
  performedBy: varchar("performed_by", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const copyEventsRelations = relations(copyEvents, ({ one }) => ({
  copy: one(copies, {
    fields: [copyEvents.copyId],
    references: [copies.id],
  }),
}));
