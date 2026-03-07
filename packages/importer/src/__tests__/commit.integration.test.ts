import { randomUUID } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  books,
  createDb,
  importRunPayloads,
  importRuns,
  memberProfiles,
} from "@bookshare/db";
import { eq } from "drizzle-orm";
import { runCommitCommand } from "../commands/commit";

const databaseUrl = process.env.DATABASE_URL;
const shouldRunIntegration =
  Boolean(databaseUrl) && process.env.RUN_IMPORTER_INTEGRATION_TESTS === "1";
const integrationTest = shouldRunIntegration ? test : test.skip;

describe("importer commit integration", () => {
  integrationTest("rolls back all writes when commit-time conflict is found", async () => {
    if (!databaseUrl) return;
    const db = createDb(databaseUrl);
    const suffix = randomUUID().slice(0, 8);

    const actorUserId = `it_actor_${suffix}`;
    const ownerUserId = `it_owner_${suffix}`;
    const actorUsername = `it_actor_${suffix}`;
    const ownerUsername = `it_owner_${suffix}`;

    const newBookTitle = `Rollback New ${suffix}`;
    const newEditionIsbn = "9780306406157";

    let runId = "";

    try {
      await db.insert(memberProfiles).values([
        {
          userId: actorUserId,
          username: actorUsername,
          displayName: "Integration Actor",
        },
        {
          userId: ownerUserId,
          username: ownerUsername,
          displayName: "Integration Owner",
        },
      ]);

      const [run] = await db
        .insert(importRuns)
        .values({
          actorUsername,
          sourceZipName: `integration-${suffix}.zip`,
          sourceZipSha256: "f".repeat(64),
          status: "validated",
          rowCount: 3,
          issueCount: 0,
          summary: {
            totalRows: 3,
            validRows: 3,
            issueCount: 0,
            files: {
              "books.csv": { rowCount: 1 },
              "editions.csv": { rowCount: 1 },
              "copies.csv": { rowCount: 0 },
              "wants.csv": { rowCount: 1 },
            },
            issues: [],
          },
          validatedAt: new Date(),
        })
        .returning({ id: importRuns.id });
      runId = run!.id;

      await db.insert(importRunPayloads).values([
        {
          runId,
          entityType: "books",
          rowNumber: 1,
          sourceRef: "b_new",
          payload: {
            sourceRef: "b_new",
            title: newBookTitle,
            subtitle: null,
            description: null,
            language: "en",
            authorNames: [],
          },
        },
        {
          runId,
          entityType: "editions",
          rowNumber: 1,
          sourceRef: "e_new",
          payload: {
            sourceRef: "e_new",
            bookIdRef: "b_new",
            isbn: newEditionIsbn,
            format: "paperback",
            publisher: null,
            publishedYear: null,
            pageCount: null,
            verificationOverrideNote: null,
          },
        },
        {
          runId,
          entityType: "wants",
          rowNumber: 1,
          sourceRef: "w_new",
          payload: {
            sourceRef: "w_new",
            editionIdRef: "missing_edition",
            username: ownerUsername,
            userId: ownerUserId,
            notes: "should fail commit",
          },
        },
      ]);

      await expect(runCommitCommand({ runId })).rejects.toThrow(
        "Cannot resolve edition_id 'missing_edition' for want 'w_new'"
      );

      const createdNewBook = await db.query.books.findFirst({
        where: eq(books.title, newBookTitle),
      });
      expect(createdNewBook).toBeNull();

      const stillValidated = await db.query.importRuns.findFirst({
        where: eq(importRuns.id, runId),
      });
      expect(stillValidated?.status).toBe("validated");
    } finally {
      if (runId) {
        await db.delete(importRuns).where(eq(importRuns.id, runId));
      }
      await db.delete(memberProfiles).where(eq(memberProfiles.userId, ownerUserId));
      await db.delete(memberProfiles).where(eq(memberProfiles.userId, actorUserId));
    }
  });
});
