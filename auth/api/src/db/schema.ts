import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const authOrganizationStatusEnum = pgEnum("auth_organization_status", [
  "active",
  "suspended",
]);

export const authOrganizationRoleEnum = pgEnum("auth_organization_role", [
  "admin",
  "staff",
]);

export const authOrganizationInviteStatusEnum = pgEnum(
  "auth_organization_invite_status",
  ["pending", "accepted", "revoked"]
);

export const authUserProfiles = pgTable(
  "auth_user_profiles",
  {
    userId: varchar("user_id", { length: 255 }).primaryKey(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    emailVerified: boolean("email_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("auth_user_profiles_email_idx").on(table.email)]
);

export const authOrganizations = pgTable(
  "auth_organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    status: authOrganizationStatusEnum("status").notNull().default("active"),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("auth_organizations_status_idx").on(table.status),
    index("auth_organizations_created_by_idx").on(table.createdBy),
  ]
);

export const authOrganizationMemberships = pgTable(
  "auth_organization_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => authOrganizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 }).notNull(),
    role: authOrganizationRoleEnum("role").notNull().default("staff"),
    invitedBy: varchar("invited_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_org_memberships_org_user_unique").on(
      table.organizationId,
      table.userId
    ),
    index("auth_org_memberships_user_idx").on(table.userId),
    index("auth_org_memberships_org_role_idx").on(
      table.organizationId,
      table.role
    ),
  ]
);

export const authOrganizationInvites = pgTable(
  "auth_organization_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => authOrganizations.id, { onDelete: "cascade" }),
    invitedEmail: varchar("invited_email", { length: 320 }).notNull(),
    role: authOrganizationRoleEnum("role").notNull().default("staff"),
    invitedBy: varchar("invited_by", { length: 255 }).notNull(),
    acceptedBy: varchar("accepted_by", { length: 255 }),
    status: authOrganizationInviteStatusEnum("status")
      .notNull()
      .default("pending"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("auth_org_invites_org_email_pending_unique")
      .on(table.organizationId, table.invitedEmail)
      .where(sql`${table.status} = 'pending'`),
    index("auth_org_invites_email_idx").on(table.invitedEmail),
    index("auth_org_invites_org_status_idx").on(
      table.organizationId,
      table.status
    ),
  ]
);

export const authOrganizationsRelations = relations(
  authOrganizations,
  ({ many }) => ({
    memberships: many(authOrganizationMemberships),
    invites: many(authOrganizationInvites),
  })
);

export const authUserProfilesRelations = relations(
  authUserProfiles,
  ({ many }) => ({
    memberships: many(authOrganizationMemberships),
  })
);

export const authOrganizationMembershipsRelations = relations(
  authOrganizationMemberships,
  ({ one }) => ({
    organization: one(authOrganizations, {
      fields: [authOrganizationMemberships.organizationId],
      references: [authOrganizations.id],
    }),
    profile: one(authUserProfiles, {
      fields: [authOrganizationMemberships.userId],
      references: [authUserProfiles.userId],
    }),
  })
);

export const authOrganizationInvitesRelations = relations(
  authOrganizationInvites,
  ({ one }) => ({
    organization: one(authOrganizations, {
      fields: [authOrganizationInvites.organizationId],
      references: [authOrganizations.id],
    }),
  })
);
