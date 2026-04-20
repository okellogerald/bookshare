import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { organizationInviteStatusEnum } from "./enums";

export const organizationInvites = pgTable(
  "organization_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invitedEmail: varchar("invited_email", { length: 320 }).notNull(),
    invitedBy: varchar("invited_by", { length: 255 }).notNull(),
    acceptedBy: varchar("accepted_by", { length: 255 }),
    status: organizationInviteStatusEnum("status").notNull().default("pending"),
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
    uniqueIndex("organization_invites_org_email_pending_unique")
      .on(table.organizationId, table.invitedEmail)
      .where(sql`${table.status} = 'pending'`),
    index("organization_invites_email_idx").on(table.invitedEmail),
    index("organization_invites_org_status_idx").on(
      table.organizationId,
      table.status
    ),
  ]
);

export const organizationInvitesRelations = relations(
  organizationInvites,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationInvites.organizationId],
      references: [organizations.id],
    }),
  })
);
