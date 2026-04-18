/**
 * Admin App Middleware — Route Protection with Role Enforcement
 *
 * Similar to the Web middleware but with an additional authorization layer:
 * after verifying the session is valid and email is verified, it checks that
 * the user has at least one recognized admin-console role
 * (`platform_admin` or `platform_staff`). Users without those roles are
 * redirected to the landing page.
 *
 * This provides defense-in-depth: the callback route already rejects
 * non-staff users, but the middleware catches edge cases like sessions
 * created before role revocation.
 *
 * @see `apps/web/src/middleware.ts` — Web app equivalent (no role check)
 * @see `/api/auth/callback` — where roles are first validated at login time
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/domain/auth/lib/crypto";
import { PlatformRole, isAdminConsoleRole } from "@bookshare/shared";
import {
  ADMIN_LOGGED_OUT_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_TOKEN_COOKIE,
} from "@/domain/auth/lib/cookie-names";
import { buildAuthPortalVerificationUrl } from "@/domain/auth/lib/auth-portal";

/** Admin route prefixes that require a valid session with elevated roles. */
const protectedPrefixes = ["/catalog", "/batches", "/members", "/team", "/staff", "/requests"];
/** Auth API routes that must always be accessible mid-flow. */
const authPaths = ["/api/auth/login", "/api/auth/callback", "/api/auth/logout"];
/** Set of roles that grant access to the admin app. */
const allowedRoles = new Set([
  PlatformRole.PLATFORM_ADMIN,
  PlatformRole.PLATFORM_STAFF,
]);

/** Session expiresAt is a Unix timestamp (seconds). Compare against wall clock. */
function isSessionExpired(value: unknown): boolean {
  if (typeof value !== "number") return true;
  return Date.now() > value * 1000;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (authPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const loggedOutMarker =
    request.cookies.get(ADMIN_LOGGED_OUT_COOKIE)?.value === "1";

  const loginUrl = new URL("/api/auth/login", request.url);
  loginUrl.searchParams.set(
    "returnTo",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  const landingUrl = new URL("/", request.url);
  landingUrl.searchParams.set("logged_out", "1");

  if (!sessionCookie) {
    return NextResponse.redirect(loggedOutMarker ? landingUrl : loginUrl);
  }

  try {
    const session = JSON.parse(await decrypt(sessionCookie)) as {
      expiresAt?: unknown;
      user?: { emailVerified?: unknown; roles?: unknown };
    };

    if (isSessionExpired(session.expiresAt)) {
      const response = NextResponse.redirect(loggedOutMarker ? landingUrl : loginUrl);
      response.cookies.delete(ADMIN_SESSION_COOKIE);
      response.cookies.delete(ADMIN_TOKEN_COOKIE);
      return response;
    }

    // Email verification gate — same as Web middleware.
    if (session.user?.emailVerified !== true) {
      return NextResponse.redirect(buildAuthPortalVerificationUrl());
    }

    // Role gate — unique to Admin middleware.
    // Extract roles from the session (populated during callback from ID token
    // claims, which were injected by Auth-Portal's consent handler).
    const roles = Array.isArray(session.user?.roles)
      ? session.user.roles.filter((value): value is string => typeof value === "string")
      : [];

    // Reject users without any recognized admin-console role.
    if (!roles.some(isAdminConsoleRole)) {
      const response = NextResponse.redirect(landingUrl);
      response.cookies.delete(ADMIN_SESSION_COOKIE);
      response.cookies.delete(ADMIN_TOKEN_COOKIE);
      return response;
    }
  } catch {
    return NextResponse.redirect(loggedOutMarker ? landingUrl : loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
