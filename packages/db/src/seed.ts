import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import type { Database } from "./index";
import { categories } from "./schema/categories";
import * as schema from "./schema";

interface ThemaNode {
  code: string;
  label: string;
}

interface ThemaJson {
  nodesByCode: Record<string, ThemaNode>;
}

interface SeedSummary {
  created: number;
  unchanged: number;
  updated: number;
}

const HELP_TEXT = `
Seed Thema categories into the local database from the bundled JSON.

Usage:
  DATABASE_URL=... bun run --cwd packages/db seed

Environment variables:
  DATABASE_URL   Required — connection string for the target database.
  THEMA_JSON     Optional — path to a thema-v1.6.json file (defaults to resources/thema-v1.6.json).
`.trim();

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const thisDir = fileURLToPath(new URL(".", import.meta.url));
  const defaultJsonPath = resolve(thisDir, "../../../resources/thema-v1.6.json");
  const jsonPath = process.env.THEMA_JSON ?? defaultJsonPath;

  const themaJson = JSON.parse(readFileSync(jsonPath, "utf8")) as ThemaJson;
  const entries = Object.values(themaJson.nodesByCode);
  if (entries.length === 0) {
    throw new Error("No Thema nodes found in JSON");
  }

  const sql = postgres(databaseUrl);
  const db: Database = drizzle(sql, { schema });

  try {
    const summary = await upsertCategories(db, entries);
    console.log(
      [
        `Thema nodes in JSON: ${entries.length}`,
        `Created: ${summary.created}`,
        `Updated: ${summary.updated}`,
        `Unchanged: ${summary.unchanged}`,
      ].join("\n")
    );
  } finally {
    await sql.end();
  }
}

async function upsertCategories(
  db: Database,
  entries: ThemaNode[]
): Promise<SeedSummary> {
  const summary: SeedSummary = { created: 0, unchanged: 0, updated: 0 };

  for (const entry of entries) {
    const existing = await db
      .select({ themaCode: categories.themaCode, name: categories.name })
      .from(categories)
      .where(eq(categories.themaCode, entry.code))
      .then((rows) => rows[0] ?? null);

    if (!existing) {
      await db.insert(categories).values({
        themaCode: entry.code,
        name: entry.label,
      });
      summary.created += 1;
      continue;
    }

    if (existing.name === entry.label) {
      summary.unchanged += 1;
      continue;
    }

    await db
      .update(categories)
      .set({ name: entry.label })
      .where(eq(categories.themaCode, entry.code));
    summary.updated += 1;
  }

  return summary;
}

await main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
