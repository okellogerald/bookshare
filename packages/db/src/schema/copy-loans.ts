import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  text,
} from "drizzle-orm/pg-core";
import { copies } from "./copies";
import { memberProfiles } from "./member-profiles";
import { copyLoanTypeEnum, counterpartyTypeEnum } from "./enums";

export { copyLoanTypeEnum, counterpartyTypeEnum };

// Active and historical loan records for copies.
export const copyLoans = pgTable(
  "copy_loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Owner/tenant scope: whose library this loan record belongs to.
    userId: varchar("user_id", { length: 255 }).notNull(),
    copyId: uuid("copy_id")
      .notNull()
      .references(() => copies.id, { onDelete: "cascade" }),
    loanType: copyLoanTypeEnum("loan_type").notNull(),
    counterpartyType: counterpartyTypeEnum("counterparty_type").notNull(),
    counterpartyUserId: varchar("counterparty_user_id", { length: 255 }).references(
      () => memberProfiles.userId,
      { onDelete: "set null" }
    ),
    externalName: varchar("external_name", { length: 255 }),
    externalContact: varchar("external_contact", { length: 500 }),
    notes: text("notes"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    // Actor: who created this loan record.
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
    index("copy_loans_user_id_idx").on(table.userId),
    index("copy_loans_copy_id_idx").on(table.copyId),
    uniqueIndex("copy_loans_active_copy_idx")
      .on(table.copyId)
      .where(sql`${table.returnedAt} IS NULL`),
    check(
      "copy_loans_counterparty_consistency",
      sql`(
        (${table.counterpartyType} = 'member' AND ${table.counterpartyUserId} IS NOT NULL AND ${table.externalName} IS NULL AND ${table.externalContact} IS NULL)
        OR
        (${table.counterpartyType} = 'external' AND ${table.counterpartyUserId} IS NULL AND ${table.externalName} IS NOT NULL)
      )`
    ),
    check(
      "copy_loans_returned_after_started",
      sql`${table.returnedAt} IS NULL OR ${table.returnedAt} >= ${table.startedAt}`
    ),
  ]
);

export const copyLoansRelations = relations(copyLoans, ({ one }) => ({
  copy: one(copies, {
    fields: [copyLoans.copyId],
    references: [copies.id],
  }),
  ownerProfile: one(memberProfiles, {
    fields: [copyLoans.userId],
    references: [memberProfiles.userId],
    relationName: "loanOwnerProfile",
  }),
  counterpartyProfile: one(memberProfiles, {
    fields: [copyLoans.counterpartyUserId],
    references: [memberProfiles.userId],
    relationName: "loanCounterpartyProfile",
  }),
}));
