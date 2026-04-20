import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  organizationStatusEnum,
  organizationTypeEnum,
} from "./enums";
import { organizationMemberships } from "./organization-memberships";
import { organizationInvites } from "./organization-invites";
import { bookstoreProposals } from "./bookstore-proposals";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: organizationTypeEnum("type").notNull().default("bookstore"),
    status: organizationStatusEnum("status").notNull().default("pending"),
    name: varchar("name", { length: 255 }).notNull(),
    websiteUrl: varchar("website_url", { length: 2000 }),
    phone: varchar("phone", { length: 255 }),
    email: varchar("email", { length: 320 }),
    whatsapp: varchar("whatsapp", { length: 255 }),
    instagram: varchar("instagram", { length: 255 }),
    address: text("address"),
    contactNote: text("contact_note"),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    reviewedBy: varchar("reviewed_by", { length: 255 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    ownerActivatedAt: timestamp("owner_activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("organizations_status_idx").on(table.status),
    index("organizations_type_idx").on(table.type),
    index("organizations_created_by_idx").on(table.createdBy),
  ]
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(organizationMemberships),
  invites: many(organizationInvites),
  proposals: many(bookstoreProposals),
}));
