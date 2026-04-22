import { and, eq } from "drizzle-orm";
import {
  createDb,
  organizationInvites,
  organizationMemberships,
} from "@bookshare/db";
import {
  BookstoreMembershipRole,
  BookstoreStatus,
  OrganizationType,
  isAdminConsoleRole,
  sanitizeRelativeReturnTo,
} from "@bookshare/shared";
import {
  getAdminAppPublicUrl,
  getBookshareAppPublicUrl,
  getBookstoresAppPublicUrl,
} from "@/shared/lib/config";
import type { KratosSession } from "@/shared/lib/kratos";
import { resolvePlatformRoles } from "@/shared/lib/staff-roles";

export type LoginResolutionSource = "web" | "admin" | "bookstores" | "auth";

export type LoginDestination =
  | { kind: "admin" }
  | { kind: "bookstore"; bookstoreId: string; path: string }
  | { kind: "bookstore_choice"; path: string }
  | { kind: "web" };

type Db = ReturnType<typeof createDb>;

let cachedDb: Db | null = null;

function getDb(): Db | null {
  if (cachedDb) return cachedDb;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return null;

  cachedDb = createDb(connectionString);
  return cachedDb;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized ? normalized : null;
}

function getSessionEmail(session: KratosSession): string | null {
  return normalizeEmail(
    (session.identity?.traits as { email?: unknown } | undefined)?.email
  );
}

function getBookstorePrimaryPath(bookstore: {
  id: string;
  status: string;
}): string {
  return bookstore.status === BookstoreStatus.APPROVED
    ? `/orgs/${bookstore.id}/wants`
    : `/orgs/${bookstore.id}/profile`;
}

async function acceptPendingBookstoreInvites(
  db: Db,
  userId: string,
  email: string
): Promise<void> {
  const invites = await db.query.organizationInvites.findMany({
    where: and(
      eq(organizationInvites.invitedEmail, email),
      eq(organizationInvites.status, "pending")
    ),
    with: { organization: true },
  });

  const bookstoreInvites = invites.filter(
    (invite) => invite.organization.type === OrganizationType.BOOKSTORE
  );

  if (bookstoreInvites.length === 0) return;

  const now = new Date();

  await db.transaction(async (tx) => {
    for (const invite of bookstoreInvites) {
      await tx
        .insert(organizationMemberships)
        .values({
          organizationId: invite.organizationId,
          userId,
          role: BookstoreMembershipRole.MEMBER,
        })
        .onConflictDoNothing({
          target: [
            organizationMemberships.organizationId,
            organizationMemberships.userId,
          ],
        });

      await tx
        .update(organizationInvites)
        .set({
          status: "accepted",
          acceptedBy: userId,
          acceptedAt: now,
        })
        .where(
          and(
            eq(organizationInvites.id, invite.id),
            eq(organizationInvites.status, "pending")
          )
        );
    }
  });
}

async function resolveBookstoreDestination(
  userId: string,
  email: string | null
): Promise<LoginDestination | null> {
  const db = getDb();
  if (!db) return null;

  if (email) {
    await acceptPendingBookstoreInvites(db, userId, email);
  }

  const memberships = await db.query.organizationMemberships.findMany({
    where: eq(organizationMemberships.userId, userId),
    with: { organization: true },
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  const bookstoreMemberships = memberships.filter(
    (entry) => entry.organization.type === OrganizationType.BOOKSTORE
  );

  if (bookstoreMemberships.length === 0) return null;

  if (bookstoreMemberships.length === 1) {
    const organization = bookstoreMemberships[0].organization;
    return {
      kind: "bookstore",
      bookstoreId: organization.id,
      path: getBookstorePrimaryPath(organization),
    };
  }

  return { kind: "bookstore_choice", path: "/" };
}

export function parseLoginResolutionSource(
  value: string | null
): LoginResolutionSource {
  return value === "web" || value === "admin" || value === "bookstores"
    ? value
    : "auth";
}

export async function resolveLoginDestination(
  session: KratosSession
): Promise<LoginDestination> {
  const userId = session.identity?.id;
  const email = getSessionEmail(session);

  if (!userId) {
    return { kind: "web" };
  }

  const roles = await resolvePlatformRoles({ userId, email });
  if (roles.some(isAdminConsoleRole)) {
    return { kind: "admin" };
  }

  const bookstoreDestination = await resolveBookstoreDestination(userId, email);
  if (bookstoreDestination) {
    return bookstoreDestination;
  }

  return { kind: "web" };
}

function buildUrl(base: string, path: string): string {
  return new URL(path, base).toString();
}

function buildHandoffUrl(base: string, returnTo: string): string {
  const url = new URL("/api/auth/login", base);
  url.searchParams.set("returnTo", returnTo);
  url.searchParams.set("handoff", "1");
  return url.toString();
}

export function buildLoginDestinationUrl({
  destination,
  source,
  requestedReturnTo,
}: {
  destination: LoginDestination;
  source: LoginResolutionSource;
  requestedReturnTo: string | null;
}): string {
  switch (destination.kind) {
    case "admin": {
      const adminReturnTo =
        source === "admin"
          ? sanitizeRelativeReturnTo(requestedReturnTo, "/catalog")
          : "/catalog";
      return source === "admin"
        ? buildUrl(getAdminAppPublicUrl(), adminReturnTo)
        : buildHandoffUrl(getAdminAppPublicUrl(), adminReturnTo);
    }

    case "bookstore":
      return source === "bookstores"
        ? buildUrl(getBookstoresAppPublicUrl(), destination.path)
        : buildHandoffUrl(getBookstoresAppPublicUrl(), destination.path);

    case "bookstore_choice":
      return source === "bookstores"
        ? buildUrl(getBookstoresAppPublicUrl(), destination.path)
        : buildHandoffUrl(getBookstoresAppPublicUrl(), destination.path);

    case "web": {
      const webReturnTo =
        source === "web"
          ? sanitizeRelativeReturnTo(requestedReturnTo, "/browse")
          : "/browse";
      return source === "web"
        ? buildUrl(getBookshareAppPublicUrl(), webReturnTo)
        : buildHandoffUrl(getBookshareAppPublicUrl(), webReturnTo);
    }
  }
}
