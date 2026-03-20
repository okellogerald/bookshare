import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUrl = new URL("/register", url.origin);
  return NextResponse.redirect(redirectUrl);
}
