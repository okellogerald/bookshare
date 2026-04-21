import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createAuthDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export type AuthDatabase = ReturnType<typeof createAuthDb>;
