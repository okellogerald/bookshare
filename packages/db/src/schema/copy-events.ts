import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { copies } from "./copies";
import { copyStatusEnum, copyEventTypeEnum } from "./enums";

export { copyEventTypeEnum };

// Immutable audit log for copy lifecycle and notes.
export const copyEvents = pgTable("copy_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Owner/tenant scope: whose copy timeline this event belongs to.
  // Used by RLS for visibility checks.
  userId: varchar("user_id", { length: 255 }).notNull(),
  copyId: uuid("copy_id")
    .notNull()
    .references(() => copies.id, { onDelete: "cascade" }),
  eventType: copyEventTypeEnum("event_type").notNull(),
  fromStatus: copyStatusEnum("from_status"),
  toStatus: copyStatusEnum("to_status"),
  // Actor: who performed the action (may differ from userId for imports/admin actions).
  performedBy: varchar("performed_by", { length: 255 }).notNull(),
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
