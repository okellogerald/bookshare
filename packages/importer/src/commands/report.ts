import { createDb, importRuns } from "@booktrack/db";
import { eq } from "drizzle-orm";
import { requireDatabaseUrl } from "../env";
import { summaryIssuesToCsv } from "../reporter";
import type { ImportSummary } from "../types";

export async function runReportCommand(params: {
  runId: string;
  format: "json" | "csv";
}) {
  const databaseUrl = requireDatabaseUrl();
  const db = createDb(databaseUrl);

  const run = await db.query.importRuns.findFirst({
    where: eq(importRuns.id, params.runId),
  });
  if (!run) {
    throw new Error(`Run '${params.runId}' was not found`);
  }

  const summary = run.summary as ImportSummary;

  if (params.format === "csv") {
    process.stdout.write(summaryIssuesToCsv(summary));
    return;
  }

  const output = {
    runId: run.id,
    status: run.status,
    actorUsername: run.actorUsername,
    sourceZipName: run.sourceZipName,
    sourceZipSha256: run.sourceZipSha256,
    createdAt: run.createdAt,
    validatedAt: run.validatedAt,
    committedAt: run.committedAt,
    summary,
  };

  console.log(JSON.stringify(output, null, 2));
}
