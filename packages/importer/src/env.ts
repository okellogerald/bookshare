import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function requireDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    const cwd = process.cwd();
    const candidateEnvFiles = [
      resolve(cwd, ".env"),
      resolve(cwd, "..", ".env"),
      resolve(cwd, "..", "..", ".env"),
    ];

    for (const envPath of candidateEnvFiles) {
      loadDotEnvFile(envPath);
      if (process.env.DATABASE_URL) break;
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  return databaseUrl;
}
