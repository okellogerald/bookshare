import { NextResponse, type NextRequest } from "next/server";

// Keep a no-op middleware module present so the running Next.js dev server
// does not fail while hot-reloading after middleware removal/refactors.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/register", "/setup"],
};
