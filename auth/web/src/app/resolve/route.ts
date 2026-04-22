import { NextRequest, NextResponse } from "next/server";
import {
  buildLoginDestinationUrl,
  parseLoginResolutionSource,
  resolveLoginDestination,
} from "@/shared/lib/login-destination";
import {
  createBrowserFlowUrl,
  getKratosSession,
  isKratosEmailVerified,
  isKratosProfileComplete,
} from "@/shared/lib/kratos";

export const runtime = "nodejs";

function buildAuthUrl(pathname: string, requestUrl: string): string {
  return new URL(pathname, requestUrl).toString();
}

function buildSettingsUrl(requestUrl: string): string {
  const settingsUrl = new URL(buildAuthUrl("/settings", requestUrl));
  settingsUrl.searchParams.set("section", "profile");
  return settingsUrl.toString();
}

export async function GET(request: NextRequest) {
  const session = await getKratosSession(request.headers.get("cookie") ?? "");

  if (!session?.identity?.id) {
    return NextResponse.redirect(createBrowserFlowUrl("login", request.url));
  }

  if (!isKratosEmailVerified(session)) {
    return NextResponse.redirect(buildAuthUrl("/verification", request.url));
  }

  if (!isKratosProfileComplete(session)) {
    return NextResponse.redirect(buildSettingsUrl(request.url));
  }

  const destination = await resolveLoginDestination(session);
  const source = parseLoginResolutionSource(
    request.nextUrl.searchParams.get("source")
  );
  const destinationUrl = buildLoginDestinationUrl({
    destination,
    source,
    requestedReturnTo: request.nextUrl.searchParams.get("returnTo"),
  });

  return NextResponse.redirect(destinationUrl);
}
