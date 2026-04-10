import { pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const staffRoleEnum = pgEnum("staff_role", [
  "owner",
  "manager",
  "staff",
  "viewer",
]);

export const staffRoles = pgTable(
  "staff_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    role: staffRoleEnum("role").notNull(),
    grantedBy: varchar("granted_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("staff_roles_user_role_unique").on(t.userId, t.role),
  ]
);
