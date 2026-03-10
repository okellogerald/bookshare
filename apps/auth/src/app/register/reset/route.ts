import { NextResponse } from "next/server";

const REGISTER_FLOW_COOKIE = "bookshare_register_flow";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUrl = new URL("/register", url.origin);

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete(REGISTER_FLOW_COOKIE);
  return response;
}
