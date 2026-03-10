import { NextResponse, type NextRequest } from "next/server";

const REGISTER_FLOW_COOKIE = "bookshare_register_flow";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/setup") {
    const response = NextResponse.next();
    response.cookies.delete(REGISTER_FLOW_COOKIE);
    return response;
  }

  if (pathname !== "/register") {
    return NextResponse.next();
  }

  const flow = searchParams.get("flow");

  if (flow && flow.trim().length > 0) {
    const response = NextResponse.next();
    response.cookies.set(REGISTER_FLOW_COOKIE, flow, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    });
    return response;
  }

  const savedFlow = request.cookies.get(REGISTER_FLOW_COOKIE)?.value?.trim();
  if (!savedFlow) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.searchParams.set("flow", savedFlow);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/register", "/setup"],
};
