import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { permissionGrantScopeTypeEnum } from "./enums";

export const permissionGrants = pgTable(
  "permission_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    permission: varchar("permission", { length: 128 }).notNull(),
    scopeType: permissionGrantScopeTypeEnum("scope_type").notNull(),
    scopeId: varchar("scope_id", { length: 255 }).notNull(),
    grantedBy: varchar("granted_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("permission_grants_user_permission_scope_unique").on(
      table.userId,
      table.permission,
      table.scopeType,
      table.scopeId
    ),
    index("permission_grants_user_idx").on(table.userId),
    index("permission_grants_scope_idx").on(table.scopeType, table.scopeId),
  ]
);
