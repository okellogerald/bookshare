import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { memberProfiles } from "./member-profiles";
import {
  organizationMembershipRoleEnum,
  organizationMembershipStatusEnum,
} from "./enums";

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 }).notNull(),
    role: organizationMembershipRoleEnum("role").notNull().default("member"),
    status: organizationMembershipStatusEnum("status")
      .notNull()
      .default("active"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_memberships_org_user_unique").on(
      table.organizationId,
      table.userId
    ),
    index("organization_memberships_user_idx").on(table.userId),
    index("organization_memberships_org_role_idx").on(
      table.organizationId,
      table.role
    ),
    index("organization_memberships_org_status_idx").on(
      table.organizationId,
      table.status
    ),
  ]
);

export const organizationMembershipsRelations = relations(
  organizationMemberships,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMemberships.organizationId],
      references: [organizations.id],
    }),
    userProfile: one(memberProfiles, {
      fields: [organizationMemberships.userId],
      references: [memberProfiles.userId],
    }),
  })
);
