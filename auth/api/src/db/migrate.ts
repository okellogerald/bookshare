import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "@bookshare/logger";
import postgres from "postgres";

const logger = createLogger({ service: "auth-api-migrations" });
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run auth API migrations.");
}

const sql = postgres(databaseUrl, { max: 1 });
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

try {
  await sql`
    CREATE TABLE IF NOT EXISTS auth_api_migrations (
      name text PRIMARY KEY,
      applied_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `;

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const applied = await sql<{ name: string }[]>`
      SELECT name FROM auth_api_migrations WHERE name = ${file}
    `;
    if (applied.length > 0) continue;

    const contents = await readFile(join(migrationsDir, file), "utf8");
    const statements = contents
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await sql.unsafe(statement);
    }
    await sql`
      INSERT INTO auth_api_migrations (name) VALUES (${file})
    `;

    logger.info({ migration: file }, "Applied auth API migration");
  }
} finally {
  await sql.end();
}
