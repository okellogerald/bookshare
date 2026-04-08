import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUrl = new URL("/register", url.origin);

  // Start-over must discard the current flow id but preserve the eventual
  // destination, otherwise the user loses context after resetting the form.
  const returnTo = url.searchParams.get("return_to");
  if (returnTo && returnTo.trim().length > 0) {
    redirectUrl.searchParams.set("return_to", returnTo);
  }

  return NextResponse.redirect(redirectUrl);
}
