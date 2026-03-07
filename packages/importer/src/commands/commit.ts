import {
  authors,
  bookAuthors,
  books,
  copies,
  copyEvents,
  createDb,
  editions,
  importEntityRefs,
  importRunPayloads,
  importRuns,
  memberProfiles,
  wants,
} from "@booktrack/db";
import type {
  NormalizedBookRow,
  NormalizedCopyRow,
  NormalizedEditionRow,
  NormalizedWantRow,
} from "../types";
import { requireDatabaseUrl } from "../env";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

interface GroupedPayloads {
  books: NormalizedBookRow[];
  editions: NormalizedEditionRow[];
  copies: NormalizedCopyRow[];
  wants: NormalizedWantRow[];
}

function normalizeIsbn(value: string): string {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function toPayloadGroups(rows: Array<{ entityType: string; payload: unknown }>): GroupedPayloads {
  const grouped: GroupedPayloads = {
    books: [],
    editions: [],
    copies: [],
    wants: [],
  };

  for (const row of rows) {
    if (row.entityType === "books") grouped.books.push(row.payload as NormalizedBookRow);
    if (row.entityType === "editions")
      grouped.editions.push(row.payload as NormalizedEditionRow);
    if (row.entityType === "copies") grouped.copies.push(row.payload as NormalizedCopyRow);
    if (row.entityType === "wants") grouped.wants.push(row.payload as NormalizedWantRow);
  }

  return grouped;
}

async function assertNoExistingEntityRefs(
  refs: Array<{ entityType: "books" | "editions" | "copies" | "wants"; sourceRef: string }>,
  tx: any
) {
  const grouped = new Map<string, string[]>();
  for (const ref of refs) {
    const key = ref.entityType;
    const values = grouped.get(key) ?? [];
    values.push(ref.sourceRef);
    grouped.set(key, values);
  }

  for (const [entityType, sourceRefs] of grouped.entries()) {
    if (sourceRefs.length === 0) continue;
    const matches = await tx
      .select({ sourceRef: importEntityRefs.sourceRef })
      .from(importEntityRefs)
      .where(
        and(
          eq(importEntityRefs.entityType, entityType as any),
          inArray(importEntityRefs.sourceRef, sourceRefs)
        )
      );
    if (matches.length > 0) {
      const first = matches[0]!;
      throw new Error(
        `Create-only conflict for ${entityType}: source_ref '${first.sourceRef}' already exists`
      );
    }
  }
}

async function loadExistingEditionMaps(
  tx: any
) {
  const rows = await tx
    .select({ id: editions.id, isbn: editions.isbn, bookId: editions.bookId })
    .from(editions)
    .where(isNotNull(editions.isbn));

  const byNormalizedIsbn = new Map<string, { id: string; bookId: string; isbn: string }>();
  for (const row of rows) {
    const normalized = normalizeIsbn(row.isbn!);
    byNormalizedIsbn.set(normalized, {
      id: row.id,
      bookId: row.bookId,
      isbn: row.isbn!,
    });
  }

  return byNormalizedIsbn;
}

export async function runCommitCommand(params: { runId: string }) {
  const databaseUrl = requireDatabaseUrl();
  const db = createDb(databaseUrl);

  const run = await db.query.importRuns.findFirst({
    where: eq(importRuns.id, params.runId),
  });

  if (!run) {
    throw new Error(`Run '${params.runId}' was not found`);
  }
  if (run.status !== "validated") {
    throw new Error(
      `Run '${params.runId}' must be in 'validated' status before commit (current: ${run.status})`
    );
  }

  const payloadRows = await db
    .select({
      entityType: importRunPayloads.entityType,
      rowNumber: importRunPayloads.rowNumber,
      payload: importRunPayloads.payload,
    })
    .from(importRunPayloads)
    .where(eq(importRunPayloads.runId, params.runId))
    .orderBy(importRunPayloads.entityType, importRunPayloads.rowNumber);

  if (payloadRows.length === 0) {
    throw new Error(`Run '${params.runId}' has no payload rows to commit`);
  }

  const payloads = toPayloadGroups(payloadRows);

  await db.transaction(async (tx) => {
    const lockRows = await tx.execute(sql`
      select id
      from import_runs
      where id = ${params.runId}::uuid and status = 'validated'
      for update
    `);
    if (lockRows.length === 0) {
      throw new Error("Run is no longer in validated state");
    }

    const actor = await tx.query.memberProfiles.findFirst({
      where: eq(memberProfiles.username, run.actorUsername),
    });
    if (!actor) {
      throw new Error(
        `Actor '${run.actorUsername}' was not found in member_profiles at commit time`
      );
    }

    const refsToCreate = [
      ...payloads.books.map((row) => ({ entityType: "books" as const, sourceRef: row.sourceRef })),
      ...payloads.editions.map((row) => ({
        entityType: "editions" as const,
        sourceRef: row.sourceRef,
      })),
      ...payloads.copies.map((row) => ({ entityType: "copies" as const, sourceRef: row.sourceRef })),
      ...payloads.wants.map((row) => ({ entityType: "wants" as const, sourceRef: row.sourceRef })),
    ];

    await assertNoExistingEntityRefs(refsToCreate, tx as any);

    const existingEditionsByIsbn = await loadExistingEditionMaps(tx as any);
    for (const editionRow of payloads.editions) {
      if (existingEditionsByIsbn.has(editionRow.isbn)) {
        throw new Error(
          `Create-only conflict: edition ISBN '${editionRow.isbn}' already exists`
        );
      }
    }

    const bookIdBySourceRef = new Map<string, string>();
    const authorIdByName = new Map<string, string>();

    // Preload authors for faster link creation.
    const authorNames = new Set<string>();
    for (const row of payloads.books) {
      for (const name of row.authorNames) {
        authorNames.add(name);
      }
    }
    if (authorNames.size > 0) {
      const existingAuthors = await tx
        .select({ id: authors.id, name: authors.name })
        .from(authors)
        .where(inArray(authors.name, [...authorNames]));
      for (const existingAuthor of existingAuthors) {
        authorIdByName.set(existingAuthor.name, existingAuthor.id);
      }
    }

    for (const row of payloads.books) {
      const [createdBook] = await tx
        .insert(books)
        .values({
          title: row.title,
          subtitle: row.subtitle,
          description: row.description,
          language: row.language,
        })
        .returning();

      if (!createdBook) {
        throw new Error(`Failed to create book for source_ref '${row.sourceRef}'`);
      }

      bookIdBySourceRef.set(row.sourceRef, createdBook.id);

      if (row.authorNames.length > 0) {
        const authorIds: string[] = [];
        for (const name of row.authorNames) {
          let authorId = authorIdByName.get(name);
          if (!authorId) {
            const [createdAuthor] = await tx
              .insert(authors)
              .values({ name })
              .returning({ id: authors.id });
            if (!createdAuthor) {
              throw new Error(`Failed to create author '${name}'`);
            }
            authorId = createdAuthor.id;
            authorIdByName.set(name, authorId);
          }
          authorIds.push(authorId);
        }

        if (authorIds.length > 0) {
          await tx.insert(bookAuthors).values(
            authorIds.map((authorId) => ({
              bookId: createdBook.id,
              authorId,
            }))
          );
        }
      }
    }

    const editionByIsbn = new Map<string, { editionId: string; bookId: string }>();
    for (const row of payloads.editions) {
      const bookId = bookIdBySourceRef.get(row.bookRef);
      if (!bookId) {
        throw new Error(
          `Cannot resolve book_ref '${row.bookRef}' for edition '${row.sourceRef}'`
        );
      }

      const [createdEdition] = await tx
        .insert(editions)
        .values({
          bookId,
          isbn: row.isbn,
          format: row.format as any,
          publisher: row.publisher,
          publishedYear: row.publishedYear,
          pageCount: row.pageCount,
        })
        .returning({ id: editions.id, bookId: editions.bookId });

      if (!createdEdition) {
        throw new Error(
          `Failed to create edition for source_ref '${row.sourceRef}'`
        );
      }

      editionByIsbn.set(row.isbn, {
        editionId: createdEdition.id,
        bookId: createdEdition.bookId,
      });
    }

    // Merge existing editions after creation for copy/want resolution.
    for (const [isbn, edition] of existingEditionsByIsbn) {
      if (!editionByIsbn.has(isbn)) {
        editionByIsbn.set(isbn, {
          editionId: edition.id,
          bookId: edition.bookId,
        });
      }
    }

    const now = new Date();
    const createdEntityRefs: Array<{
      entityType: "books" | "editions" | "copies" | "wants";
      sourceRef: string;
      entityId: string;
    }> = [];

    for (const row of payloads.books) {
      const bookId = bookIdBySourceRef.get(row.sourceRef);
      if (!bookId) {
        throw new Error(`Missing committed ID for book '${row.sourceRef}'`);
      }
      createdEntityRefs.push({
        entityType: "books",
        sourceRef: row.sourceRef,
        entityId: bookId,
      });
    }

    for (const row of payloads.editions) {
      const edition = editionByIsbn.get(row.isbn);
      if (!edition) {
        throw new Error(`Missing committed ID for edition '${row.sourceRef}'`);
      }
      createdEntityRefs.push({
        entityType: "editions",
        sourceRef: row.sourceRef,
        entityId: edition.editionId,
      });
    }

    for (const row of payloads.copies) {
      const edition = editionByIsbn.get(row.editionIsbn);
      if (!edition) {
        throw new Error(
          `Cannot resolve edition_isbn '${row.editionIsbn}' for copy '${row.sourceRef}'`
        );
      }

      const [createdCopy] = await tx
        .insert(copies)
        .values({
          userId: row.userId,
          editionId: edition.editionId,
          condition: row.condition as any,
          status: row.status as any,
          acquisitionType: row.acquisitionType as any,
          acquisitionDate: row.acquisitionDate ? new Date(row.acquisitionDate) : null,
          location: row.location,
          notes: row.notes,
          shareType: row.shareType as any,
          contactNote: row.contactNote,
          borrowerUserId: null,
          lastConfirmedAt: now,
        })
        .returning({ id: copies.id });

      if (!createdCopy) {
        throw new Error(`Failed to create copy '${row.sourceRef}'`);
      }

      await tx.insert(copyEvents).values({
        userId: row.userId,
        copyId: createdCopy.id,
        eventType: "acquired",
        toStatus: row.status as any,
        performedBy: actor.userId,
        notes: `Imported via run ${params.runId}`,
      });

      createdEntityRefs.push({
        entityType: "copies",
        sourceRef: row.sourceRef,
        entityId: createdCopy.id,
      });
    }

    const candidateWantRows = payloads.wants.map((row) => {
      const edition = editionByIsbn.get(row.editionIsbn);
      if (!edition) {
        throw new Error(
          `Cannot resolve edition_isbn '${row.editionIsbn}' for want '${row.sourceRef}'`
        );
      }

      return {
        sourceRef: row.sourceRef,
        userId: row.userId,
        bookId: edition.bookId,
        notes: row.notes,
      };
    });

    if (candidateWantRows.length > 0) {
      const userIds = [...new Set(candidateWantRows.map((row) => row.userId))];
      const bookIds = [...new Set(candidateWantRows.map((row) => row.bookId))];

      const existingActiveWants = await tx
        .select({ userId: wants.userId, bookId: wants.bookId })
        .from(wants)
        .where(
          and(
            inArray(wants.userId, userIds),
            inArray(wants.bookId, bookIds),
            eq(wants.status, "active")
          )
        );

      if (existingActiveWants.length > 0) {
        const first = existingActiveWants[0]!;
        throw new Error(
          `Create-only conflict: active want already exists for user '${first.userId}' and book '${first.bookId}'`
        );
      }
    }

    for (const row of candidateWantRows) {
      const [createdWant] = await tx
        .insert(wants)
        .values({
          userId: row.userId,
          bookId: row.bookId,
          notes: row.notes,
          status: "active",
          lastConfirmedAt: now,
        })
        .returning({ id: wants.id });

      if (!createdWant) {
        throw new Error(`Failed to create want '${row.sourceRef}'`);
      }

      createdEntityRefs.push({
        entityType: "wants",
        sourceRef: row.sourceRef,
        entityId: createdWant.id,
      });
    }

    if (createdEntityRefs.length > 0) {
      await tx.insert(importEntityRefs).values(
        createdEntityRefs.map((row) => ({
          runId: params.runId,
          entityType: row.entityType,
          sourceRef: row.sourceRef,
          entityId: row.entityId,
        }))
      );
    }

    const [updatedRun] = await tx
      .update(importRuns)
      .set({
        status: "committed",
        committedAt: new Date(),
      })
      .where(and(eq(importRuns.id, params.runId), eq(importRuns.status, "validated")))
      .returning({ id: importRuns.id });

    if (!updatedRun) {
      throw new Error("Failed to mark run as committed");
    }
  });

  console.log(
    JSON.stringify(
      {
        runId: params.runId,
        status: "committed",
      },
      null,
      2
    )
  );
}
