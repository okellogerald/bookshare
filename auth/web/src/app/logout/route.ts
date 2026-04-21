/**
 * Kratos Session Logout — Auth-Portal
 *
 * Phase 3 (final phase) of the logout flow. By this point:
 * - Phase 1: client app cleared its cookies
 * - Phase 2: Hydra invalidated its OAuth session
 *
 * This handler clears the Kratos session cookie (`ory_kratos_session`) by:
 * 1. Calling Kratos's `/self-service/logout/browser` endpoint with the
 *    browser's cookies to get a logout confirmation URL.
 * 2. Redirecting the browser to that URL, which clears the cookie.
 * 3. Kratos then redirects to the `return_to` URL (the client app's landing page).
 *
 * After this, all three layers are logged out:
 * - Client app cookies: cleared (Phase 1)
 * - Hydra OAuth session: invalidated (Phase 2)
 * - Kratos identity session: cleared (Phase 3)
 *
 * @see `apps/web/src/app/api/auth/post-logout/route.ts` — what redirects here
 * @see `auth/web/src/app/oauth/logout/route.ts` — Phase 2
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getAuthPortalPublicUrl,
  getBookshareAppPublicUrl,
  getKratosBrowserUrl,
  getKratosInternalPublicUrl,
} from "@/shared/lib/config";

/**
 * Sanitize the return_to URL against a whitelist of allowed origins.
 * Prevents open redirect attacks via the logout flow.
 */
function sanitizeReturnTo(value: string | null): string {
  const fallback = getBookshareAppPublicUrl();
  if (!value) return fallback;

  try {
    const parsed = new URL(value);
    const allowedOrigins = new Set([
      new URL(fallback).origin,
      new URL(getAuthPortalPublicUrl()).origin,
    ]);

    if (!allowedOrigins.has(parsed.origin)) {
      return fallback;
    }

    return parsed.toString();
  } catch {
    return fallback;
  }
}

/**
 * Convert an internal Kratos URL (or relative path) to a browser-facing URL.
 * Kratos may return redirect URLs relative to its internal address — this
 * rewrites them to the public-facing Kratos URL that the browser can reach.
 */
function toKratosBrowserUrl(value: string): URL {
  return new URL(value, getKratosBrowserUrl());
}

export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(
    request.nextUrl.searchParams.get("return_to")
  );
  const logoutFlowUrl = new URL(
    "/self-service/logout/browser",
    getKratosInternalPublicUrl()
  );
  logoutFlowUrl.searchParams.set("return_to", returnTo);

  const cookieHeader = request.headers.get("cookie") ?? "";
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  try {
    const response = await fetch(logoutFlowUrl.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
      redirect: "manual",
    });

    const location = response.headers.get("location");
    if (location) {
      return NextResponse.redirect(toKratosBrowserUrl(location));
    }

    if (response.status === 401) {
      return NextResponse.redirect(returnTo);
    }

    if (!response.ok) {
      console.error("Kratos logout flow creation failed", {
        status: response.status,
      });
      return NextResponse.redirect(returnTo);
    }

    const body = (await response.json()) as { logout_url?: unknown };
    if (typeof body.logout_url === "string" && body.logout_url.trim().length > 0) {
      return NextResponse.redirect(toKratosBrowserUrl(body.logout_url));
    }

    return NextResponse.redirect(returnTo);
  } catch (error) {
    console.error("Auth portal logout failed", error);
    return NextResponse.redirect(returnTo);
  }
}
