import { randomUUID } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  books,
  createDb,
  editions,
  importRunPayloads,
  importRuns,
  memberProfiles,
  wants,
} from "@booktrack/db";
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

    const existingBookTitle = `Rollback Existing ${suffix}`;
    const newBookTitle = `Rollback New ${suffix}`;
    const existingEditionIsbn = "9780132350884";
    const newEditionIsbn = "9780306406157";

    let existingBookId = "";
    let existingEditionId = "";
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

      const [existingBook] = await db
        .insert(books)
        .values({
          title: existingBookTitle,
          language: "en",
        })
        .returning({ id: books.id });
      existingBookId = existingBook!.id;

      const [existingEdition] = await db
        .insert(editions)
        .values({
          bookId: existingBookId,
          isbn: existingEditionIsbn,
          format: "paperback",
        })
        .returning({ id: editions.id });
      existingEditionId = existingEdition!.id;

      await db.insert(wants).values({
        userId: ownerUserId,
        bookId: existingBookId,
        status: "active",
      });

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
            bookRef: "b_new",
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
            editionIsbn: existingEditionIsbn,
            username: ownerUsername,
            userId: ownerUserId,
            notes: "should conflict",
          },
        },
      ]);

      await expect(runCommitCommand({ runId })).rejects.toThrow(
        "Create-only conflict: active want already exists"
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
      await db.delete(wants).where(eq(wants.userId, ownerUserId));

      if (runId) {
        await db.delete(importRuns).where(eq(importRuns.id, runId));
      }
      if (existingEditionId) {
        await db.delete(editions).where(eq(editions.id, existingEditionId));
      }
      if (existingBookId) {
        await db.delete(books).where(eq(books.id, existingBookId));
      }
      await db.delete(memberProfiles).where(eq(memberProfiles.userId, ownerUserId));
      await db.delete(memberProfiles).where(eq(memberProfiles.userId, actorUserId));
    }
  });
});
