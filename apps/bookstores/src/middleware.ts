import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/domain/auth/lib/crypto";
import {
  BOOKSTORES_LOGGED_OUT_COOKIE,
  BOOKSTORES_SESSION_COOKIE,
  BOOKSTORES_TOKEN_COOKIE,
} from "@/domain/auth/lib/cookie-names";
import { buildAuthPortalVerificationUrl } from "@/domain/auth/lib/auth-portal";

const protectedPrefixes = ["/orgs"];
const authPaths = ["/api/auth/login", "/api/auth/callback", "/api/auth/logout"];

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

  const sessionCookie = request.cookies.get(BOOKSTORES_SESSION_COOKIE)?.value;
  const loggedOutMarker =
    request.cookies.get(BOOKSTORES_LOGGED_OUT_COOKIE)?.value === "1";

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
      user?: { emailVerified?: unknown };
    };

    if (isSessionExpired(session.expiresAt)) {
      const response = NextResponse.redirect(loggedOutMarker ? landingUrl : loginUrl);
      response.cookies.delete(BOOKSTORES_SESSION_COOKIE);
      response.cookies.delete(BOOKSTORES_TOKEN_COOKIE);
      return response;
    }

    if (session.user?.emailVerified !== true) {
      return NextResponse.redirect(buildAuthPortalVerificationUrl());
    }
  } catch {
    return NextResponse.redirect(loggedOutMarker ? landingUrl : loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
