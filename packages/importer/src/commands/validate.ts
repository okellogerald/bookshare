import { createDb, importRunPayloads, importRuns } from "@bookshare/db";
import type { ImportEntityType } from "../types";
import { requireDatabaseUrl } from "../env";
import { validateParsedInput } from "../validation";
import { parseZipFile } from "../zip";

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

export async function runValidateCommand(params: {
  zipPath: string;
  actorUsername: string;
}) {
  const databaseUrl = requireDatabaseUrl();
  const db = createDb(databaseUrl);
  const actorIdentifier = params.actorUsername.trim();

  const parsedZip = await parseZipFile(params.zipPath);
  const validation = await validateParsedInput(db, parsedZip, actorIdentifier);

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
      ...payloadRowsForEntity(run.id, "wants", validation.payloads.wants),
    ];

    if (payloadRows.length > 0) {
      await db.insert(importRunPayloads).values(payloadRows);
    }
  }

  const output = {
    runId: run.id,
    status: validation.status,
    summary: validation.summary,
  };

  console.log(JSON.stringify(output, null, 2));
  if (validation.status !== "validated") {
    process.exitCode = 2;
  }
}
