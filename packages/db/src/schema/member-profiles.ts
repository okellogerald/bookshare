import { relations } from "drizzle-orm";
import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { copies } from "./copies";
import { wants } from "./wants";

export const memberProfiles = pgTable("member_profiles", {
  userId: varchar("user_id", { length: 255 }).primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  nickname: varchar("nickname", { length: 255 }),
  gender: varchar("gender", { length: 100 }),
  cityArea: varchar("city_area", { length: 255 }),
  contactHandle: varchar("contact_handle", { length: 500 }),
  avatarUrl: varchar("avatar_url", { length: 2000 }),
  identityUpdatedAt: timestamp("identity_updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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
