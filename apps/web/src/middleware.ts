/**
 * Web App Middleware — Route Protection
 *
 * Runs on every request (except static assets) and acts as the client-side
 * auth gate. For protected routes, it:
 *
 * 1. Checks for the encrypted session cookie (`bookshare_session`).
 * 2. Decrypts and validates: is the session expired? Is the email verified?
 * 3. Redirects unauthenticated users to `/api/auth/login` (which starts the
 *    OAuth2 flow) or to the landing page if they explicitly logged out.
 *
 * This is the first line of defense — it runs in the Edge Runtime before
 * any page rendering. The resource server (NestJS API) performs its own
 * token validation independently, so even if middleware is bypassed, API
 * calls are still protected.
 *
 * Auth routes (/api/auth/*) are always allowed through — they handle
 * their own state and must be accessible mid-flow.
 *
 * @see `session.ts` — session encryption/decryption
 * @see `/api/auth/login` — where unauthenticated users are redirected
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/domains/auth/lib/crypto";
import {
  WEB_LOGGED_OUT_COOKIE,
  WEB_SESSION_COOKIE,
  WEB_TOKEN_COOKIE,
} from "@/domains/auth/lib/cookie-names";

/**
 * Route prefixes that require a valid, non-expired session with verified email.
 * Keep this aligned with pages under `app/(app)`.
 */
const protectedPagePrefixes = [
  "/community",
  "/my-library",
  "/my-wishlist",
  "/notifications",
  "/profile",
  "/settings",
];

/** Auth API routes that must always be accessible (even without a session). */
const authPaths = ["/api/auth/login", "/api/auth/callback", "/api/auth/logout"];

/** Session expiresAt is a Unix timestamp (seconds). Compare against wall clock. */
function isSessionExpired(value: unknown): boolean {
  if (typeof value !== "number") return true;
  return Date.now() > value * 1000;
}

/** Strict check — only boolean true counts; null/undefined/"true" do not. */
function isEmailVerified(value: unknown): boolean {
  return value === true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth routes are always accessible
  if (authPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check if this is a protected route
  const isProtected = protectedPagePrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // --- Protected route: validate session ---
  const session = request.cookies.get(WEB_SESSION_COOKIE);

  // The logged-out marker is set by /api/auth/logout. When present, we send
  // the user to the landing page (with a "logged_out" flag) instead of
  // auto-redirecting them into the login flow.
  const loggedOutMarker =
    request.cookies.get(WEB_LOGGED_OUT_COOKIE)?.value === "1";

  // Preserve the user's original destination so /api/auth/login can redirect
  // them back after authentication completes.
  const loginUrl = new URL("/api/auth/login", request.url);
  loginUrl.searchParams.set(
    "returnTo",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  const landingUrl = new URL("/", request.url);
  landingUrl.searchParams.set("logged_out", "1");
  landingUrl.searchParams.set(
    "returnTo",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  // No session cookie at all — redirect based on logout state.
  if (!session?.value) {
    if (loggedOutMarker) {
      return NextResponse.redirect(landingUrl);
    }
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Decrypt the AES-256-GCM encrypted session and parse it.
    const decrypted = await decrypt(session.value);
    const sessionData = JSON.parse(decrypted) as {
      expiresAt?: unknown;
      user?: { emailVerified?: unknown };
    };

    // Expired session: clean up stale cookies and redirect.
    if (isSessionExpired(sessionData.expiresAt)) {
      const response = NextResponse.redirect(loggedOutMarker ? landingUrl : loginUrl);
      response.cookies.delete(WEB_SESSION_COOKIE);
      response.cookies.delete(WEB_TOKEN_COOKIE);
      return response;
    }

    // Unverified email: redirect to Auth-Portal's verification page.
    // This can happen if the user's verification status changed after
    // the session was created.
    if (!isEmailVerified(sessionData.user?.emailVerified)) {
      const verificationUrl = new URL("/auth/verification", request.url);
      verificationUrl.searchParams.set(
        "returnTo",
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      );
      return NextResponse.redirect(verificationUrl);
    }
  } catch {
    // Decryption or parsing failure — session cookie is corrupted.
    return NextResponse.redirect(loggedOutMarker ? landingUrl : loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
