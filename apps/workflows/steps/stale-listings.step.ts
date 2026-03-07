/**
 * Stale Listings Step
 *
 * Weekly cron that identifies copies and wants where last_confirmed_at is
 * older than 30 days. Logs stale counts per user.
 * Future: could trigger email reminders.
 *
 * Trigger: Cron schedule (every Monday at 7:00 AM)
 * Output: stale_listings.report event
 */

import { createDb, copies, wants } from "@bookshare/db";
import { and, inArray, lt, isNotNull, count } from "drizzle-orm";

export const config = {
  name: "Stale Listings Checker",
  description: "Flag copies and wants not confirmed in the last 30 days",
  triggers: [{ type: "cron", expression: "0 0 7 * * 1 *" }],
  enqueues: ["stale_listings.report"],
} as const;

export async function handler(_input: unknown, { enqueue, logger }: any) {
  logger.info("Checking for stale listings and wants");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logger.error("DATABASE_URL not configured");
    return;
  }

  const db = createDb(connectionString);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    // Stale copies
    const staleCopyCounts = await db
      .select({
        userId: copies.userId,
        staleCount: count(),
      })
      .from(copies)
      .where(
        and(
          inArray(copies.status, ["available", "lent"] as any[]),
          isNotNull(copies.lastConfirmedAt),
          lt(copies.lastConfirmedAt, thirtyDaysAgo)
        )
      )
      .groupBy(copies.userId);

    let totalStaleCopies = 0;
    for (const row of staleCopyCounts) {
      totalStaleCopies += row.staleCount;
      logger.info(`User ${row.userId}: ${row.staleCount} stale listing(s)`);
    }

    // Stale wants
    const staleWantCounts = await db
      .select({
        userId: wants.userId,
        staleCount: count(),
      })
      .from(wants)
      .where(
        and(
          isNotNull(wants.lastConfirmedAt),
          lt(wants.lastConfirmedAt, thirtyDaysAgo)
        )
      )
      .groupBy(wants.userId);

    let totalStaleWants = 0;
    for (const row of staleWantCounts) {
      totalStaleWants += row.staleCount;
      logger.info(`User ${row.userId}: ${row.staleCount} stale want(s)`);
    }

    await enqueue({
      topic: "stale_listings.report",
      data: {
        totalStaleCopies,
        staleCopiesByUser: staleCopyCounts,
        totalStaleWants,
        staleWantsByUser: staleWantCounts,
        checkedAt: new Date().toISOString(),
      },
    });

    logger.info(
      `Stale check complete: ${totalStaleCopies} stale copies, ${totalStaleWants} stale wants`
    );
  } catch (error) {
    logger.error("Failed to check stale listings:", error);
  }
}
