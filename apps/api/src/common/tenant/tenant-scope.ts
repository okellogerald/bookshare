import { eq, and, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Creates a user-scoped WHERE clause that filters by userId.
 * Use in service methods to ensure data isolation.
 *
 * @example
 * const results = await db
 *   .select()
 *   .from(copies)
 *   .where(userScope(copies.userId, userId));
 */
export function userScope(column: PgColumn, userId: string): SQL {
  return eq(column, userId);
}

/**
 * Combines a user scope with additional WHERE conditions using AND.
 */
export function userAnd(
  column: PgColumn,
  userId: string,
  conditions: SQL[]
): SQL {
  return and(eq(column, userId), ...conditions)!;
}
