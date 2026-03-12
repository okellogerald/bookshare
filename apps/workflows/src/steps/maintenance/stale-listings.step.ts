/**
 * Stale Listings Step
 *
 * Weekly cron that identifies copies and wishes where last_confirmed_at is
 * older than 30 days. Logs stale counts per user.
 * Future: could trigger email reminders.
 *
 * Trigger: Cron schedule (every Monday at 7:00 AM)
 * Output: stale_listings.report event
 */

import { createDb, copies, wishes } from "@bookshare/db";
import { and, inArray, lt, isNotNull, count } from "drizzle-orm";
import { WorkflowFlows } from "../../config/flows";
import { WorkflowTopics } from "../../config/topics";

export const config = {
  name: "Stale Listings Checker",
  description: "Flag copies and wishes not confirmed in the last 30 days",
  flows: [WorkflowFlows.maintenance],
  triggers: [{ type: "cron", expression: "0 0 7 * * 1 *" }],
  enqueues: [WorkflowTopics.staleListingsReport],
} as const;

export async function handler(_input: unknown, { enqueue, logger }: any) {
  logger.info("Checking for stale listings and wishes");

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

    // Stale wishes
    const staleWantCounts = await db
      .select({
        userId: wishes.userId,
        staleCount: count(),
      })
      .from(wishes)
      .where(
        and(
          isNotNull(wishes.lastConfirmedAt),
          lt(wishes.lastConfirmedAt, thirtyDaysAgo)
        )
      )
      .groupBy(wishes.userId);

    let totalStaleWants = 0;
    for (const row of staleWantCounts) {
      totalStaleWants += row.staleCount;
      logger.info(`User ${row.userId}: ${row.staleCount} stale wish(s)`);
    }

    await enqueue({
      topic: WorkflowTopics.staleListingsReport,
      data: {
        totalStaleCopies,
        staleCopiesByUser: staleCopyCounts,
        totalStaleWants,
        staleWantsByUser: staleWantCounts,
        checkedAt: new Date().toISOString(),
      },
    });

    logger.info(
      `Stale check complete: ${totalStaleCopies} stale copies, ${totalStaleWants} stale wishes`
    );
  } catch (error) {
    logger.error("Failed to check stale listings:", error);
  }
}
