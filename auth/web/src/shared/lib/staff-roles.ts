/**
 * Staff Role Resolution — Auth-Portal
 *
 * Determines what platform roles a user has. Called during the consent
 * challenge handler to populate role claims in the ID and access tokens.
 *
 * Three sources of roles:
 *
 * 1. **Bootstrap admins** (BOOTSTRAP_ADMIN_EMAILS env var): A comma-separated
 *    list of emails that are automatically granted the platform-admin role.
 *    This solves the chicken-and-egg problem: you need an admin to create
 *    admins, but initially there are no admins.
 *
 * 2. **Admin email domain** (ADMIN_EMAIL_DOMAIN env var): Any verified email
 *    in this domain is granted platform-staff access to the Admin client.
 *
 * 3. **Database roles** (staff_roles table): Persistent roles assigned through
 *    the admin UI. Queried via Drizzle ORM. Supports platform_admin and
 *    platform_staff roles. These are the primary source after initial bootstrap.
 *
 * Roles from both sources are merged, and every authenticated user implicitly
 * gets the base `user` role before the result is embedded in the token claims.
 *
 * @see `/oauth/consent/route.ts` — where this is called
 * @see `apps/admin/src/middleware.ts` — where roles are enforced
 */
import { createDb, staffRoles } from "@bookshare/db";
import { PlatformRole, isAdminEmailAddress } from "@bookshare/shared";
import { eq } from "drizzle-orm";

type StaffRole = string;

/** Lazy-initialized DB connection — avoids connecting when DATABASE_URL is unset. */
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

/** Parse the BOOTSTRAP_ADMIN_EMAILS env var into a Set of normalized emails. */
function parseBootstrapEmails() {
  return new Set(
    (process.env.BOOTSTRAP_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter((value): value is string => !!value)
  );
}

/** Validate that a role string matches a known PlatformRole enum value. */
function normalizeRole(role: string): StaffRole | null {
  return Object.values(PlatformRole).includes(
    role as (typeof PlatformRole)[keyof typeof PlatformRole]
  )
    ? role
    : null;
}

/**
 * Resolve all platform roles for a user by merging bootstrap and database sources.
 *
 * @param params.userId - Kratos identity ID (for database lookup)
 * @param params.email - User's email (for bootstrap admin matching)
 * @returns Array of role strings including the implicit `user` role
 */
export async function resolvePlatformRoles(params: {
  userId: string;
  email?: string | null;
  emailVerified?: boolean;
}): Promise<StaffRole[]> {
  const roles = new Set<StaffRole>([PlatformRole.USER]);

  const email = normalizeEmail(params.email);
  if (
    params.emailVerified !== false &&
    email &&
    isAdminEmailAddress(email, process.env.ADMIN_EMAIL_DOMAIN)
  ) {
    roles.add(PlatformRole.PLATFORM_STAFF);
  }

  if (email && parseBootstrapEmails().has(email)) {
    roles.add(PlatformRole.PLATFORM_ADMIN);
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
