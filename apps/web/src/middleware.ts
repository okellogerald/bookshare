import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth-gated app routes. Keep this aligned with pages under `app/(app)`.
 */
const protectedPagePrefixes = [
  "/community",
  "/my-library",
  "/my-wants",
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

export function middleware(request: NextRequest) {
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
  const session = request.cookies.get("bookshare_session");
  const loginUrl = new URL("/api/auth/login", request.url);
  loginUrl.searchParams.set(
    "returnTo",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  if (!session?.value) {
    return NextResponse.redirect(loginUrl);
  }

  try {
    const sessionData = JSON.parse(session.value) as {
      expiresAt?: unknown;
      user?: { emailVerified?: unknown };
    };

    if (isSessionExpired(sessionData.expiresAt)) {
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("bookshare_session");
      response.cookies.delete("bookshare_token");
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
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
