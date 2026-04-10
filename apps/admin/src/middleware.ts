import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/features/auth/lib/crypto";
import {
  ADMIN_LOGGED_OUT_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_TOKEN_COOKIE,
} from "@/features/auth/lib/cookie-names";
import { buildAuthPortalVerificationUrl } from "@/features/auth/lib/auth-portal";

const protectedPrefixes = ["/catalog", "/batches", "/staff"];
const authPaths = ["/api/auth/login", "/api/auth/callback", "/api/auth/logout"];
const allowedRoles = new Set(["owner", "manager", "staff", "viewer"]);

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

    if (session.user?.emailVerified !== true) {
      return NextResponse.redirect(buildAuthPortalVerificationUrl());
    }

    const roles = Array.isArray(session.user?.roles)
      ? session.user.roles.filter((value): value is string => typeof value === "string")
      : [];

    if (!roles.some((role) => allowedRoles.has(role))) {
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
