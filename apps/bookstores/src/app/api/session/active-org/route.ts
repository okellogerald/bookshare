import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { BookstoresBootstrapResponse } from "@bookshare/shared";
import { getAccessToken, getSession } from "@/domain/auth/lib/session";
import { decrypt, encrypt } from "@/domain/auth/lib/crypto";
import { BOOKSTORES_ACTIVE_ORG_COOKIE } from "@/domain/auth/lib/cookie-names";

const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://api:3333/api";

interface ActiveOrgSession {
  userId: string;
  organizationId: string;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

async function loadMembershipIds(token: string): Promise<Set<string>> {
  const response = await fetch(`${API_URL}/bookstores/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) return new Set();

  const data = (await response.json()) as BookstoresBootstrapResponse;
  return new Set(data.memberships.map((entry) => entry.organizationId));
}

async function getActiveOrgSession(): Promise<ActiveOrgSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(BOOKSTORES_ACTIVE_ORG_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(await decrypt(raw)) as ActiveOrgSession;
    if (!isUuid(parsed.organizationId) || !parsed.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function GET() {
  const [session, token, active] = await Promise.all([
    getSession(),
    getAccessToken(),
    getActiveOrgSession(),
  ]);

  if (!session || !token) {
    return NextResponse.json({ organizationId: null }, { status: 401 });
  }

  if (!active || active.userId !== session.user.id) {
    return NextResponse.json({ organizationId: null });
  }

  const membershipIds = await loadMembershipIds(token);
  if (!membershipIds.has(active.organizationId)) {
    const response = NextResponse.json({ organizationId: null });
    response.cookies.delete(BOOKSTORES_ACTIVE_ORG_COOKIE);
    return response;
  }

  return NextResponse.json({ organizationId: active.organizationId });
}

export async function POST(request: NextRequest) {
  const [session, token] = await Promise.all([getSession(), getAccessToken()]);
  if (!session || !token) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let organizationId: unknown;
  try {
    const body = (await request.json()) as { organizationId?: unknown };
    organizationId = body.organizationId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isUuid(organizationId)) {
    return NextResponse.json(
      { error: "A valid organization id is required." },
      { status: 400 }
    );
  }

  const membershipIds = await loadMembershipIds(token);
  if (!membershipIds.has(organizationId)) {
    return NextResponse.json(
      { error: "You do not have access to that bookstore." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ organizationId });
  response.cookies.set(
    BOOKSTORES_ACTIVE_ORG_COOKIE,
    await encrypt(JSON.stringify({ userId: session.user.id, organizationId })),
    cookieOptions()
  );
  return response;
}
