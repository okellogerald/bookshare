import { createDb, type Database } from "@booktrack/db";

export const DRIZZLE = Symbol("DRIZZLE");

export class DrizzleService {
  static create(connectionString: string): Database {
    return createDb(connectionString);
  }
}
