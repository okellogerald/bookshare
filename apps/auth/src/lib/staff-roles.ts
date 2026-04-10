import { createDb, staffRoles } from "@bookshare/db";
import { UserRole } from "@bookshare/shared";
import { eq } from "drizzle-orm";

type StaffRole = string;

let cachedDb: ReturnType<typeof createDb> | null = null;

function getDb() {
  if (cachedDb) return cachedDb;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    return null;
  }

  cachedDb = createDb(connectionString);
  return cachedDb;
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function parseBootstrapEmails() {
  return new Set(
    (process.env.BOOTSTRAP_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter((value): value is string => !!value)
  );
}

function normalizeRole(role: string): StaffRole | null {
  return Object.values(UserRole).includes(role as any) ? role : null;
}

export async function resolveStaffRoles(params: {
  userId: string;
  email?: string | null;
}): Promise<StaffRole[]> {
  const roles = new Set<StaffRole>();

  const email = normalizeEmail(params.email);
  if (email && parseBootstrapEmails().has(email)) {
    roles.add(UserRole.OWNER);
  }

  const db = getDb();
  if (!db) {
    return Array.from(roles);
  }

  const persisted = await db
    .select({ role: staffRoles.role })
    .from(staffRoles)
    .where(eq(staffRoles.userId, params.userId));

  for (const entry of persisted) {
    const role = normalizeRole(entry.role);
    if (role) roles.add(role);
  }

  return Array.from(roles);
}
