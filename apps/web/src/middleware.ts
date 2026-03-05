import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * All routes except landing (/) and auth routes require authentication.
 * BookShare is a closed platform.
 */
const protectedPrefixes = [
  "/browse",
  "/wanted",
  "/community",
  "/my-library",
  "/my-wants",
  "/api/postgrest",
  "/api/nestjs",
];

const authPaths = ["/api/auth/login", "/api/auth/callback", "/api/auth/logout"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth routes are always accessible
  if (authPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check if this is a protected route
  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Protected route — require session
  const session = request.cookies.get("bookshare_session");

  if (!session?.value) {
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }

  try {
    const sessionData = JSON.parse(session.value);

    if (Date.now() > sessionData.expiresAt * 1000) {
      const response = NextResponse.redirect(
        new URL("/api/auth/login", request.url)
      );
      response.cookies.delete("bookshare_session");
      response.cookies.delete("bookshare_token");
      return response;
    }
  } catch {
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
