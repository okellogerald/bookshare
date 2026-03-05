import { relations } from "drizzle-orm";
import {
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { copies } from "./copies";

export const copyImages = pgTable("copy_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  copyId: uuid("copy_id")
    .notNull()
    .references(() => copies.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  objectKey: varchar("object_key", { length: 1000 }).notNull().unique(),
  imageUrl: varchar("image_url", { length: 2000 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const copyImagesRelations = relations(copyImages, ({ one }) => ({
  copy: one(copies, {
    fields: [copyImages.copyId],
    references: [copies.id],
  }),
}));
