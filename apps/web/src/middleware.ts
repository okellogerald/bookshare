import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/features/auth/lib/crypto";
import {
  WEB_LOGGED_OUT_COOKIE,
  WEB_SESSION_COOKIE,
  WEB_TOKEN_COOKIE,
} from "@/features/auth/lib/cookie-names";

/**
 * Auth-gated app routes. Keep this aligned with pages under `app/(app)`.
 */
const protectedPagePrefixes = [
  "/community",
  "/my-library",
  "/my-wishlist",
  "/profile",
  "/settings",
];

const authPaths = ["/api/auth/login", "/api/auth/callback", "/api/auth/logout"];

function isSessionExpired(value: unknown): boolean {
  if (typeof value !== "number") return true;
  return Date.now() > value * 1000;
}

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

  // Protected route — require session
  const session = request.cookies.get(WEB_SESSION_COOKIE);
  const loggedOutMarker =
    request.cookies.get(WEB_LOGGED_OUT_COOKIE)?.value === "1";
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

  if (!session?.value) {
    if (loggedOutMarker) {
      return NextResponse.redirect(landingUrl);
    }
    return NextResponse.redirect(loginUrl);
  }

  try {
    const decrypted = await decrypt(session.value);
    const sessionData = JSON.parse(decrypted) as {
      expiresAt?: unknown;
      user?: { emailVerified?: unknown };
    };

    if (isSessionExpired(sessionData.expiresAt)) {
      const response = NextResponse.redirect(loggedOutMarker ? landingUrl : loginUrl);
      response.cookies.delete(WEB_SESSION_COOKIE);
      response.cookies.delete(WEB_TOKEN_COOKIE);
      return response;
    }

    if (!isEmailVerified(sessionData.user?.emailVerified)) {
      const verificationUrl = new URL("/auth/verification", request.url);
      verificationUrl.searchParams.set(
        "returnTo",
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      );
      return NextResponse.redirect(verificationUrl);
    }
  } catch {
    return NextResponse.redirect(loggedOutMarker ? landingUrl : loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
