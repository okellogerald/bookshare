import { createDb, type Database } from "@bookshare/db";

export const DRIZZLE = Symbol("DRIZZLE");

export class DrizzleService {
  static create(connectionString: string): Database {
    return createDb(connectionString);
  }
}
