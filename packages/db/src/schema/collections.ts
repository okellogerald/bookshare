import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { copies } from "./copies";

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const collectionsRelations = relations(collections, ({ many }) => ({
  collectionCopies: many(collectionCopies),
}));

export const collectionCopies = pgTable(
  "collection_copies",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    copyId: uuid("copy_id")
      .notNull()
      .references(() => copies.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.collectionId, table.copyId] })]
);

export const collectionCopiesRelations = relations(
  collectionCopies,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionCopies.collectionId],
      references: [collections.id],
    }),
    copy: one(copies, {
      fields: [collectionCopies.copyId],
      references: [copies.id],
    }),
  })
);
