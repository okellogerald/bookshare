import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { wishes } from "./wishes";
import { bookstoreProposalStatusEnum } from "./enums";

export const bookstoreProposals = pgTable(
  "bookstore_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    wishId: uuid("wish_id")
      .notNull()
      .references(() => wishes.id, { onDelete: "cascade" }),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    message: text("message"),
    status: bookstoreProposalStatusEnum("status").notNull().default("active"),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("bookstore_proposals_org_wish_active_unique")
      .on(table.organizationId, table.wishId)
      .where(sql`${table.status} = 'active'`),
    index("bookstore_proposals_wish_idx").on(table.wishId),
    index("bookstore_proposals_org_status_idx").on(
      table.organizationId,
      table.status
    ),
  ]
);

export const bookstoreProposalsRelations = relations(
  bookstoreProposals,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [bookstoreProposals.organizationId],
      references: [organizations.id],
    }),
    wish: one(wishes, {
      fields: [bookstoreProposals.wishId],
      references: [wishes.id],
    }),
  })
);
