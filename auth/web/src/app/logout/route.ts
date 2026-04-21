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
import {
  clearKnownAccounts,
  removeKnownAccount,
} from "@/shared/lib/known-accounts-cookie";
import { getKratosSession } from "@/shared/lib/kratos";

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

/**
 * Apply the caller's known-accounts bookkeeping choice to the response:
 *   - `forget_accounts=all`   → clear the entire chooser cookie
 *   - `forget_accounts=current` (or `forget=1`) → remove just the active
 *     identity so they stop appearing in the chooser on this device
 *   - default                 → preserve chips so quick re-auth still works
 */
async function applyKnownAccountsPolicy(
  response: NextResponse,
  request: NextRequest,
  cookieHeader: string
): Promise<void> {
  const params = request.nextUrl.searchParams;
  const mode =
    params.get("forget_accounts")?.trim().toLowerCase() ||
    (params.get("forget")?.trim() === "1" ? "current" : "");

  if (!mode) return;

  if (mode === "all") {
    clearKnownAccounts(response);
    return;
  }

  if (mode === "current") {
    const session = await getKratosSession(cookieHeader);
    const sub = session?.identity?.id;
    if (sub) {
      await removeKnownAccount(response, sub);
    }
  }
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
      const redirect = NextResponse.redirect(toKratosBrowserUrl(location));
      await applyKnownAccountsPolicy(redirect, request, cookieHeader);
      return redirect;
    }

    if (response.status === 401) {
      const redirect = NextResponse.redirect(returnTo);
      await applyKnownAccountsPolicy(redirect, request, cookieHeader);
      return redirect;
    }

    if (!response.ok) {
      console.error("Kratos logout flow creation failed", {
        status: response.status,
      });
      const redirect = NextResponse.redirect(returnTo);
      await applyKnownAccountsPolicy(redirect, request, cookieHeader);
      return redirect;
    }

    const body = (await response.json()) as { logout_url?: unknown };
    if (typeof body.logout_url === "string" && body.logout_url.trim().length > 0) {
      const redirect = NextResponse.redirect(toKratosBrowserUrl(body.logout_url));
      await applyKnownAccountsPolicy(redirect, request, cookieHeader);
      return redirect;
    }

    const redirect = NextResponse.redirect(returnTo);
    await applyKnownAccountsPolicy(redirect, request, cookieHeader);
    return redirect;
  } catch (error) {
    console.error("Auth portal logout failed", error);
    const redirect = NextResponse.redirect(returnTo);
    await applyKnownAccountsPolicy(redirect, request, cookieHeader);
    return redirect;
  }
}
