import {
  authors,
  bookAuthors,
  bookCategories,
  books,
  categories,
  copies,
  copyEvents,
  createDb,
  editions,
  importEntityRefs,
  importRunPayloads,
  importRuns,
  memberProfiles,
  wishes,
} from "@bookshare/db";
import { WorkflowTopic, type WorkflowEventEnvelope } from "@bookshare/shared";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { requireDatabaseUrl } from "./env";
import type {
  ImportEntityType,
  ImportMode,
  ImportSummary,
  NormalizedBookRow,
  NormalizedCopyRow,
  NormalizedEditionRow,
  NormalizedWantRow,
  ParsedZipInput,
} from "./types";
import { validateParsedInput } from "./validation";
import { publishWorkflowEvents } from "./workflows";
import { parseZipBuffer, parseZipFile } from "./zip";

function payloadRowsForEntity(
  runId: string,
  entityType: ImportEntityType,
  rows: unknown[]
) {
  return rows.map((payload, index) => ({
    runId,
    entityType,
    rowNumber: index + 1,
    sourceRef: (payload as { sourceRef: string }).sourceRef,
    payload,
  }));
}

function normalizeIsbn(value: string): string {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

interface GroupedPayloads {
  books: NormalizedBookRow[];
  editions: NormalizedEditionRow[];
  copies: NormalizedCopyRow[];
  wishes: NormalizedWantRow[];
}

function toPayloadGroups(rows: Array<{ entityType: string; payload: unknown }>): GroupedPayloads {
  const grouped: GroupedPayloads = {
    books: [],
    editions: [],
    copies: [],
    wishes: [],
  };

  for (const row of rows) {
    if (row.entityType === "books") grouped.books.push(row.payload as NormalizedBookRow);
    if (row.entityType === "editions") grouped.editions.push(row.payload as NormalizedEditionRow);
    if (row.entityType === "copies") grouped.copies.push(row.payload as NormalizedCopyRow);
    if (row.entityType === "wishes") grouped.wishes.push(row.payload as NormalizedWantRow);
  }

  return grouped;
}

async function assertNoExistingEntityRefs(
  refs: Array<{ entityType: "books" | "editions" | "copies" | "wishes"; sourceRef: string }>,
  tx: any
) {
  const grouped = new Map<string, string[]>();
  for (const ref of refs) {
    const values = grouped.get(ref.entityType) ?? [];
    values.push(ref.sourceRef);
    grouped.set(ref.entityType, values);
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

async function loadExistingEditionMaps(tx: any) {
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

async function clearInventoryState(tx: any) {
  await tx.delete(wishes);
  await tx.delete(copies);
  await tx
    .delete(importEntityRefs)
    .where(inArray(importEntityRefs.entityType, ["copies", "wishes"] as any));
}

export interface ImportRunValidationResult {
  runId: string;
  status: "invalid" | "validated" | "committed";
  actorUsername: string;
  sourceZipName: string;
  summary: ImportSummary;
}

export interface CommitImportRunResult {
  runId: string;
  status: "committed";
  summary: ImportSummary;
  workflowEvents: {
    attempted: number;
    delivered: number;
  };
}

async function persistValidationResult(
  db: ReturnType<typeof createDb>,
  parsedZip: ParsedZipInput,
  actorUsername: string,
  options: { mode: ImportMode; replaceInventory: boolean }
): Promise<ImportRunValidationResult> {
  const actorIdentifier = actorUsername.trim();
  const validation = await validateParsedInput(db, parsedZip, actorIdentifier, options);
  const now = new Date();

  const [run] = await db
    .insert(importRuns)
    .values({
      actorUsername: actorIdentifier,
      sourceZipName: parsedZip.zipName,
      sourceZipSha256: parsedZip.sha256,
      status: validation.status,
      rowCount: validation.summary.totalRows,
      issueCount: validation.summary.issueCount,
      summary: validation.summary,
      validatedAt: validation.status === "validated" ? now : null,
      committedAt: null,
    })
    .returning();

  if (!run) {
    throw new Error("Failed to persist import run");
  }

  if (validation.status === "validated") {
    const payloadRows = [
      ...payloadRowsForEntity(run.id, "books", validation.payloads.books),
      ...payloadRowsForEntity(run.id, "editions", validation.payloads.editions),
      ...payloadRowsForEntity(run.id, "copies", validation.payloads.copies),
      ...payloadRowsForEntity(run.id, "wishes", validation.payloads.wishes),
    ];

    if (payloadRows.length > 0) {
      await db.insert(importRunPayloads).values(payloadRows);
    }
  }

  return {
    runId: run.id,
    status: validation.status,
    actorUsername: actorIdentifier,
    sourceZipName: parsedZip.zipName,
    summary: validation.summary,
  };
}

export async function validateImportZipFile(params: {
  zipPath: string;
  actorUsername: string;
  inventoryOnly: boolean;
  replaceInventory: boolean;
}): Promise<ImportRunValidationResult> {
  const mode: ImportMode = params.inventoryOnly ? "inventory_only" : "catalog";
  if (params.replaceInventory && mode !== "inventory_only") {
    throw new Error("--replace-inventory is only allowed with --inventory-only");
  }

  const db = createDb(requireDatabaseUrl());
  const parsedZip = await parseZipFile(params.zipPath, { mode });
  return persistValidationResult(db, parsedZip, params.actorUsername, {
    mode,
    replaceInventory: params.replaceInventory,
  });
}

export async function validateImportZipBuffer(params: {
  zipBuffer: ArrayBuffer | Uint8Array | Buffer;
  zipName: string;
  actorUsername: string;
  inventoryOnly: boolean;
  replaceInventory: boolean;
}): Promise<ImportRunValidationResult> {
  const mode: ImportMode = params.inventoryOnly ? "inventory_only" : "catalog";
  if (params.replaceInventory && mode !== "inventory_only") {
    throw new Error("--replace-inventory is only allowed with --inventory-only");
  }

  const db = createDb(requireDatabaseUrl());
  const parsedZip = await parseZipBuffer(params.zipBuffer, params.zipName, { mode });
  return persistValidationResult(db, parsedZip, params.actorUsername, {
    mode,
    replaceInventory: params.replaceInventory,
  });
}

export async function commitImportRun(params: {
  runId: string;
  onProgress?: (stage: string, detail?: string) => void;
}): Promise<CommitImportRunResult> {
  const reportProgress = params.onProgress ?? (() => {});
  const db = createDb(requireDatabaseUrl());
  const workflowEvents: WorkflowEventEnvelope[] = [];
  reportProgress("starting", `run_id=${params.runId}`);

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

  const summary = run.summary as ImportSummary;
  const mode = summary.mode ?? "catalog";
  const replaceInventory = summary.replaceInventory === true;
  if (replaceInventory && mode !== "inventory_only") {
    throw new Error(
      "Run options are inconsistent: replaceInventory=true requires mode=inventory_only"
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

  if (payloadRows.length === 0 && !replaceInventory) {
    throw new Error(`Run '${params.runId}' has no payload rows to commit`);
  }

  const payloads = toPayloadGroups(payloadRows);
  reportProgress(
    "payload loaded",
    `mode=${mode}, replace_inventory=${replaceInventory}, books=${payloads.books.length}, editions=${payloads.editions.length}, copies=${payloads.copies.length}, wishes=${payloads.wishes.length}`
  );

  try {
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

      const requiresActor = payloads.copies.length > 0;
      const actorIdentifier = run.actorUsername.trim().toLowerCase();
      const actor = requiresActor
        ? await tx.query.memberProfiles.findFirst({
            where: and(
              isNotNull(memberProfiles.email),
              eq(memberProfiles.email, actorIdentifier)
            ),
          })
        : null;

      if (requiresActor && !actor) {
        throw new Error(
          `Actor '${run.actorUsername}' was not found in member_profiles by email at commit time`
        );
      }

      const refsToCreate = [
        ...payloads.books.map((row) => ({
          entityType: "books" as const,
          sourceRef: row.sourceRef,
        })),
        ...payloads.editions.map((row) => ({
          entityType: "editions" as const,
          sourceRef: row.sourceRef,
        })),
        ...(replaceInventory
          ? []
          : payloads.copies.map((row) => ({
              entityType: "copies" as const,
              sourceRef: row.sourceRef,
            }))),
        ...(replaceInventory
          ? []
          : payloads.wishes.map((row) => ({
              entityType: "wishes" as const,
              sourceRef: row.sourceRef,
            }))),
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

      if (replaceInventory) {
        await clearInventoryState(tx);
      }

      const bookIdBySourceRef = new Map<string, string>();
      const authorIdByName = new Map<string, string>();
      const categoryIdBySlug = new Map<string, string>();

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

      const categorySlugs = new Set<string>();
      for (const row of payloads.books) {
        for (const slug of row.categorySlugs) {
          categorySlugs.add(slug);
        }
      }
      if (categorySlugs.size > 0) {
        const existingCategories = await tx
          .select({ id: categories.id, slug: categories.slug })
          .from(categories)
          .where(inArray(categories.slug, [...categorySlugs]));

        for (const existingCategory of existingCategories) {
          categoryIdBySlug.set(existingCategory.slug, existingCategory.id);
        }

        for (const slug of categorySlugs) {
          if (!categoryIdBySlug.has(slug)) {
            throw new Error(
              `Category slug '${slug}' could not be resolved at commit time`
            );
          }
        }
      }

      for (const row of payloads.books) {
        const [createdBook] = await tx
          .insert(books)
          .values({
            title: row.title,
            subtitle: row.subtitle,
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
      for (const [isbn, existing] of existingEditionsByIsbn.entries()) {
        editionByIsbn.set(isbn, {
          editionId: existing.id,
          bookId: existing.bookId,
        });
      }

      const editionIdBySourceRef = new Map<string, string>();
      for (const row of payloads.editions) {
        const bookId = bookIdBySourceRef.get(row.bookIdRef);
        if (!bookId) {
          throw new Error(
            `Cannot resolve book_id '${row.bookIdRef}' for edition '${row.sourceRef}'`
          );
        }

        const [createdEdition] = await tx
          .insert(editions)
          .values({
            bookId,
            isbn: row.isbn,
            format: row.format as any,
            description: row.description,
            publisher: row.publisher,
            publishedYear: row.publishedYear,
            pageCount: row.pageCount,
            coverImageUrl: row.coverImageUrl,
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
        editionIdBySourceRef.set(row.sourceRef, createdEdition.id);
      }

      const bookCategoryRows: Array<{ bookId: string; categoryId: string }> = [];
      for (const row of payloads.books) {
        const bookId = bookIdBySourceRef.get(row.sourceRef);
        if (!bookId) {
          throw new Error(`Missing committed ID for book '${row.sourceRef}'`);
        }

        for (const slug of row.categorySlugs) {
          const categoryId = categoryIdBySlug.get(slug);
          if (!categoryId) {
            throw new Error(
              `Category slug '${slug}' could not be resolved for book '${row.sourceRef}'`
            );
          }
          bookCategoryRows.push({ bookId, categoryId });
        }
      }
      if (bookCategoryRows.length > 0) {
        await tx.insert(bookCategories).values(bookCategoryRows);
      }

      const now = new Date();
      const createdEntityRefs: Array<{
        entityType: "books" | "editions" | "copies" | "wishes";
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
        const editionId = editionIdBySourceRef.get(row.sourceRef);
        if (!editionId) {
          throw new Error(`Missing committed ID for edition '${row.sourceRef}'`);
        }
        createdEntityRefs.push({
          entityType: "editions",
          sourceRef: row.sourceRef,
          entityId: editionId,
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
            notes: row.notes,
            shareType: row.shareType as any,
            contactNote: row.contactNote,
            lastConfirmedAt: now,
          })
          .returning({ id: copies.id });

        if (!createdCopy) {
          throw new Error(`Failed to create copy '${row.sourceRef}'`);
        }

        await tx.insert(copyEvents).values({
          userId: row.userId,
          copyId: createdCopy.id,
          eventType: "listed",
          toStatus: row.status as any,
          performedBy: actor!.userId,
          notes: `Imported via run ${params.runId}`,
        });

        createdEntityRefs.push({
          entityType: "copies",
          sourceRef: row.sourceRef,
          entityId: createdCopy.id,
        });
        workflowEvents.push({
          topic: WorkflowTopic.COPY_CREATED,
          data: {
            copyId: createdCopy.id,
            userId: row.userId,
          },
        });
      }

      const candidateWantRows = payloads.wishes.map((row) => {
        const edition = editionByIsbn.get(row.editionIsbn);
        if (!edition) {
          throw new Error(
            `Cannot resolve edition_isbn '${row.editionIsbn}' for wish '${row.sourceRef}'`
          );
        }

        return {
          sourceRef: row.sourceRef,
          userId: row.userId,
          editionId: edition.editionId,
          bookId: edition.bookId,
          notes: row.notes,
        };
      });

      if (!replaceInventory && candidateWantRows.length > 0) {
        const userIds = [...new Set(candidateWantRows.map((row) => row.userId))];
        const bookIds = [...new Set(candidateWantRows.map((row) => row.bookId))];

        const existingActiveWants = await tx
          .select({ userId: wishes.userId, bookId: wishes.bookId })
          .from(wishes)
          .where(
            and(
              inArray(wishes.userId, userIds),
              inArray(wishes.bookId, bookIds),
              eq(wishes.status, "active")
            )
          );

        if (existingActiveWants.length > 0) {
          const first = existingActiveWants[0]!;
          throw new Error(
            `Create-only conflict: active wish already exists for user '${first.userId}' and book '${first.bookId}'`
          );
        }
      }

      const seenWantBookKeys = new Set<string>();
      for (const row of candidateWantRows) {
        const wantBookKey = `${row.userId}::${row.bookId}`;
        if (seenWantBookKeys.has(wantBookKey)) {
          throw new Error(
            `Duplicate active wish in run for user '${row.userId}' and book '${row.bookId}'`
          );
        }
        seenWantBookKeys.add(wantBookKey);

        const [createdWant] = await tx
          .insert(wishes)
          .values({
            userId: row.userId,
            bookId: row.bookId,
            editionId: row.editionId,
            notes: row.notes,
            status: "active",
            lastConfirmedAt: now,
          })
          .returning({ id: wishes.id });

        if (!createdWant) {
          throw new Error(`Failed to create wish '${row.sourceRef}'`);
        }

        createdEntityRefs.push({
          entityType: "wishes",
          sourceRef: row.sourceRef,
          entityId: createdWant.id,
        });
        workflowEvents.push({
          topic: WorkflowTopic.WISH_CREATED,
          data: {
            wishId: createdWant.id,
            userId: row.userId,
          },
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown commit failure";
    reportProgress("failed", message);
    throw error;
  }

  const publishResult = await publishWorkflowEvents(workflowEvents);
  return {
    runId: params.runId,
    status: "committed",
    summary,
    workflowEvents: {
      attempted: publishResult.attempted,
      delivered: publishResult.delivered,
    },
  };
}

export async function listRecentImportRuns(limit = 10) {
  const db = createDb(requireDatabaseUrl());
  const runs = await db.query.importRuns.findMany({
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    limit,
  });

  return runs.map((run) => ({
    runId: run.id,
    status: run.status,
    actorUsername: run.actorUsername,
    sourceZipName: run.sourceZipName,
    rowCount: run.rowCount,
    issueCount: run.issueCount,
    createdAt: run.createdAt,
    validatedAt: run.validatedAt,
    committedAt: run.committedAt,
    summary: run.summary as ImportSummary,
  }));
}
