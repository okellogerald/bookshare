import { NextResponse, type NextRequest } from "next/server";
import { decrypt } from "@/organizations/auth/crypto";
import {
  AUTH_ORG_LOGGED_OUT_COOKIE,
  AUTH_ORG_SESSION_COOKIE,
  AUTH_ORG_TOKEN_COOKIE,
} from "@/organizations/auth/cookie-names";
import { isPlatformAdminRole } from "@/organizations/auth/roles";

const protectedPrefixes = ["/organizations"];
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

  const sessionCookie = request.cookies.get(AUTH_ORG_SESSION_COOKIE)?.value;
  const loggedOutMarker =
    request.cookies.get(AUTH_ORG_LOGGED_OUT_COOKIE)?.value === "1";
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
      response.cookies.delete(AUTH_ORG_SESSION_COOKIE);
      response.cookies.delete(AUTH_ORG_TOKEN_COOKIE);
      return response;
    }

    if (session.user?.emailVerified !== true) {
      return NextResponse.redirect(new URL("/verification", request.url));
    }

    if (pathname.startsWith("/organizations/admin")) {
      const roles = Array.isArray(session.user.roles)
        ? session.user.roles.filter((value): value is string => typeof value === "string")
        : [];
      if (!roles.some(isPlatformAdminRole)) {
        return NextResponse.redirect(new URL("/organizations", request.url));
      }
    }
  } catch {
    return NextResponse.redirect(loggedOutMarker ? landingUrl : loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
