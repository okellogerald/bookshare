import { relations } from "drizzle-orm";
import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { copies } from "./copies";
import { wants } from "./wants";

export const memberProfiles = pgTable("member_profiles", {
  userId: varchar("user_id", { length: 255 }).primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  cityArea: varchar("city_area", { length: 255 }),
  contactHandle: varchar("contact_handle", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const memberProfilesRelations = relations(memberProfiles, ({ many }) => ({
  wants: many(wants),
  ownedCopies: many(copies, { relationName: "ownerProfile" }),
  borrowedCopies: many(copies, { relationName: "borrowerProfile" }),
}));
