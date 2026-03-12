import { index, jsonb, pgTable, text, timestamp, uuid, varchar, boolean } from "drizzle-orm/pg-core";

// In-app notifications delivered to a single recipient.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    type: varchar("type", { length: 255 }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    read: boolean("read").notNull().default(false),
    linkTo: varchar("link_to", { length: 2000 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_user_read_created_idx").on(
      table.userId,
      table.read,
      table.createdAt
    ),
  ]
);
