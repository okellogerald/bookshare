/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Logout Initiation — Web App (Phase 1 of 3)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  This handler answers ONE question: "the user clicked 'sign out' — start
 *  tearing down every session layer."
 *
 *  Logout in this stack spans three phases; this route is the first:
 *
 *    Phase 1 (here)
 *      • Clear the Web app's own cookies (session, token, OIDC transaction).
 *      • Set the `loggedOut` marker so middleware won't auto-bounce the user
 *        straight back into a login.
 *      • Redirect to Hydra's RP-initiated logout endpoint carrying
 *        `id_token_hint` so Hydra can verify this really is our session.
 *
 *    Phase 2 (auth/web /oauth/logout)
 *      Hydra creates a logout_challenge, Auth-Portal accepts it, Hydra
 *      invalidates its OAuth session, then redirects to
 *      `post_logout_redirect_uri` (our /api/auth/post-logout).
 *
 *    Phase 3 (auth/web /logout)
 *      Kratos session cookie is cleared; the identity provider forgets
 *      the user for good.
 *
 *  ┌──────────────┬──────────────────────────────────┬─────────────────────┐
 *  │ Scenario     │ Who calls                         │ How we know         │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ A — LOGOUT   │ A user clicking "sign out"        │ Only scenario that  │
 *  │              │ (either from the app UI or via    │ lands here — no     │
 *  │              │ server redirect to /api/auth/     │ branching on caller │
 *  │              │ logout).                          │ identity.           │
 *  └──────────────┴──────────────────────────────────┴─────────────────────┘
 *
 *  @see `/api/auth/post-logout`                      — Phase 2 landing
 *  @see `auth/web/src/app/oauth/logout/route.ts`     — Phase 2 Hydra side
 *  @see `auth/web/src/app/logout/route.ts`           — Phase 3 Kratos side
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { NextRequest, NextResponse } from "next/server";
import {
  buildEndSessionParams,
  clearOIDCClientCookies,
  setLoggedOutMarker,
} from "@bookshare/shared";
import { createLogger } from "@bookshare/logger";
import * as client from "openid-client";
import { getOIDCConfig } from "@/domains/auth/lib/oidc";
import { buildAppPostLogoutUrl } from "@/domains/auth/lib/auth-portal";
import { getSession } from "@/domains/auth/lib/session";
import { WEB_OIDC_COOKIE_NAMES } from "@/domains/auth/lib/cookie-names";

const logger = createLogger({ service: "web-auth" }).child({
  route: "api.auth.logout",
});

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST TRACING
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Every request gets a short `traceId` that is automatically attached to
 * every log line produced while handling it. Grep a single traceId in the
 * logs and you'll see the entire REQUEST → intermediate steps → RESPONSE
 * trace for that one browser hit — even under concurrent load.
 */
const requestContext = new AsyncLocalStorage<{ traceId: string }>();

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const traceId = randomUUID().slice(0, 8);
  return requestContext.run({ traceId }, () => handleRequest(request));
}

async function handleRequest(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  logRequest(request);

  try {
    const response = await handleScenarioA_Logout(request);
    logResponse(response, { scenario: "A", startedAt });
    return response;
  } catch (error) {
    logError("Unhandled error during logout initiation", {
      error,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO A — Start the three-phase logout
// ═══════════════════════════════════════════════════════════════════════════
/*
 * WHO LANDS HERE
 *   A user clicking "sign out" in the Web app, or a server-side redirect
 *   to /api/auth/logout. There's no branching on caller identity — every
 *   request is treated the same way.
 *
 * REQUEST SHAPE
 *   GET /api/auth/logout
 *   (Optional) Cookie: bookshare_session — if present, we use its idToken
 *     as `id_token_hint` for Hydra. If absent, logout still proceeds; Hydra
 *     just won't be able to verify the session.
 *
 * WHAT THE BROWSER EXPECTS FROM US
 *   A 302 to Hydra's /oauth2/sessions/logout (RP-initiated logout) with the
 *   post-logout redirect URI and id_token_hint. Before we redirect we clear
 *   the Web-side cookies so Phase 2 can't observe them and we set the
 *   logged-out marker so middleware knows the user chose this.
 *
 * POSSIBLE OUTCOMES
 *   ┌───────────────────────────────────┬─────────────────────────────────┐
 *   │ Condition                         │ What we return                  │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ OIDC config loaded, end-session   │ 302 to Hydra's end-session URL  │
 *   │ URL built                         │ + session/token/transaction     │
 *   │                                   │   cookies cleared               │
 *   │                                   │ + logged-out marker set         │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ OIDC config discovery failed OR   │ 302 directly to                 │
 *   │ buildEndSessionUrl threw          │   /api/auth/post-logout         │
 *   │                                   │ + same cookie cleanup as above  │
 *   │                                   │ (skip Hydra — we can't talk to  │
 *   │                                   │  it, but Kratos cleanup in      │
 *   │                                   │  Phase 3 must still run)        │
 *   └───────────────────────────────────┴─────────────────────────────────┘
 *
 * The fallback matters: if we can't reach Hydra we MUST still clear the
 * local session and continue to Phase 3 — otherwise the user is stuck in
 * a half-logged-out state with a dead Kratos session they can't use.
 */
async function handleScenarioA_Logout(
  request: NextRequest
): Promise<NextResponse> {
  // Step 1: figure out where Hydra should send the browser after it clears
  // its own session. This URL is what the `buildAuthPortalLogoutUrl` handler
  // in /api/auth/post-logout expects to receive.
  const postLogoutRedirectUri = buildAppPostLogoutUrl();

  // Step 2: pull the current session (if any). The idToken is used as
  // id_token_hint so Hydra can verify the logout request without asking
  // the user to re-authenticate.
  const session = await getSession();
  logInfo("Current session resolved", {
    hasSession: Boolean(session),
    hasIdTokenHint: Boolean(session?.idToken),
  });

  // Step 3: try to build Hydra's end-session URL. If OIDC discovery fails
  // or the URL builder throws, we skip Hydra and go straight to Phase 2/3.
  let redirectTarget = postLogoutRedirectUri;
  let hydraReachable = false;
  try {
    const config = await getOIDCConfig();
    const params = buildEndSessionParams({
      postLogoutRedirectUri,
      clientId: process.env.OIDC_CLIENT_ID,
      idTokenHint: session?.idToken,
    });
    redirectTarget = client.buildEndSessionUrl(config, params).href;
    hydraReachable = true;
    logInfo("Hydra end-session URL built");
  } catch (error) {
    logError("Failed to build Hydra end-session URL — skipping to post-logout", {
      error,
    });
  }

  // Step 4: prepare the response and clear all client-side auth cookies.
  // We clear unconditionally — the user asked to log out, and any state
  // left behind would confuse middleware on the next request.
  const response = NextResponse.redirect(redirectTarget);
  clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
  logInfo("Client auth cookies cleared");

  // Step 5: set the logged-out marker. Middleware treats this cookie as
  // "user explicitly signed out, show the landing page rather than
  // bouncing back into login".
  setLoggedOutMarker(response.cookies, WEB_OIDC_COOKIE_NAMES.loggedOut);
  logInfo("Logged-out marker set", { hydraReachable });

  return response;
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST / RESPONSE BOOKEND LOGGERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log the incoming request in one consolidated entry. Grep by `traceId`
 * to find this plus every downstream log for the same request.
 */
function logRequest(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  logInfo("REQUEST", {
    method: request.method,
    url: request.url,
    path: request.nextUrl.pathname,
    cookiesPresent: {
      session: cookieHeader.includes(WEB_OIDC_COOKIE_NAMES.session),
      token: cookieHeader.includes(WEB_OIDC_COOKIE_NAMES.token),
      loggedOutMarker: cookieHeader.includes(WEB_OIDC_COOKIE_NAMES.loggedOut),
    },
    userAgent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
  });
}

/**
 * Log the outgoing response in one consolidated entry. Captures HTTP
 * status, redirect target (origin + pathname only — the end-session URL
 * can carry id_token_hint in its query string), and any cookies being
 * set/cleared via response.cookies.
 */
function logResponse(
  response: NextResponse,
  ctx: { scenario: "A"; startedAt: number }
) {
  const cookieActions: Array<{
    name: string;
    action: "set" | "cleared";
    maxAge?: number;
  }> = [];
  for (const cookie of response.cookies.getAll()) {
    const isCleared =
      !cookie.value ||
      cookie.maxAge === 0 ||
      (cookie.expires instanceof Date && cookie.expires.getTime() <= Date.now());
    cookieActions.push({
      name: cookie.name,
      action: isCleared ? "cleared" : "set",
      maxAge: cookie.maxAge,
    });
  }

  // Mask the redirect URL: Hydra's end-session URL carries id_token_hint
  // in its query string, which is the user's ID token. Log origin +
  // pathname only so the trace shows "where to" without the JWT.
  const rawLocation = response.headers.get("location");
  let safeLocation: string | null = null;
  if (rawLocation) {
    try {
      const parsed = new URL(rawLocation);
      safeLocation = `${parsed.origin}${parsed.pathname}`;
    } catch {
      safeLocation = rawLocation;
    }
  }

  logInfo("RESPONSE", {
    scenario: ctx.scenario,
    status: response.status,
    location: safeLocation,
    cookies: cookieActions,
    durationMs: Date.now() - ctx.startedAt,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: logging primitives (read traceId from AsyncLocalStorage)
// ═══════════════════════════════════════════════════════════════════════════

function logInfo(event: string, data?: Record<string, unknown>) {
  const ctx = requestContext.getStore();
  logger.info({ ...(data ?? {}), ...(ctx ?? {}) }, event);
}

function logError(event: string, data?: Record<string, unknown>) {
  const ctx = requestContext.getStore();
  const { error, ...rest } = data ?? {};
  logger.error({ ...rest, ...(ctx ?? {}), err: error }, event);
}
