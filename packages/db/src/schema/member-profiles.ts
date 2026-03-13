import { relations } from "drizzle-orm";
import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { copies } from "./copies";
import { copyLoans } from "./copy-loans";
import { wishes } from "./wishes";

// Community member profile mirror sourced from the identity provider.
export const memberProfiles = pgTable("member_profiles", {
  userId: varchar("user_id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  gender: varchar("gender", { length: 100 }),
  location: varchar("location", { length: 255 }),
  contactNotes: varchar("contact_notes", { length: 500 }),
  avatarUrl: varchar("avatar_url", { length: 2000 }),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
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
  wishes: many(wishes),
  ownedCopies: many(copies, { relationName: "ownerProfile" }),
  ownedLoans: many(copyLoans, { relationName: "loanOwnerProfile" }),
  counterpartyLoans: many(copyLoans, { relationName: "loanCounterpartyProfile" }),
}));
