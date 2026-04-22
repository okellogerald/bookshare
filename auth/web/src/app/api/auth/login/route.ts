/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Organizations OAuth Login Start — Auth-Portal
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  This handler answers ONE question: "can you send me to the OIDC
 *  provider so I can sign in to the organizations area?"
 *
 *  Not to be confused with the Hydra-facing login challenge handler at
 *  /oauth/login. THIS file is the Auth-Portal acting as an OAuth *client*
 *  (using the `openid-client` library) for its own "organizations"
 *  sub-area. It:
 *
 *    1. Generates PKCE material (code verifier → code challenge) + state.
 *    2. Builds the authorization URL to the configured OIDC provider.
 *    3. Stores the verifier / state / returnTo in encrypted cookies so the
 *       callback handler can finalize the exchange.
 *    4. Clears the "you just logged out" marker cookie (fresh start).
 *    5. Redirects the browser to the authorization URL.
 *
 *  ┌──────────────┬──────────────────────────────────┬─────────────────────┐
 *  │ Scenario     │ Who calls                         │ How we know         │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ A — START    │ The browser (user clicked        │ Always. This route  │
 *  │              │ "sign in", or middleware         │ has no alternative  │
 *  │              │ redirected an unauthenticated     │ arrival path.       │
 *  │              │ request here).                    │                     │
 *  └──────────────┴──────────────────────────────────┴─────────────────────┘
 *
 *  @see `../callback/route.ts` — consumes the cookies this sets
 *  @see `packages/shared/src/oidc-next` — PKCE + transaction helpers
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { NextRequest, NextResponse } from "next/server";
import {
  buildScope,
  clearLoggedOutMarker,
  createLoginTransaction,
  persistOIDCTransaction,
} from "@bookshare/shared";
import { createLogger } from "@bookshare/logger";
import * as client from "openid-client";
import { encrypt } from "@/organizations/auth/crypto";
import {
  AUTH_ORG_LOGGED_OUT_COOKIE,
  AUTH_ORG_OIDC_COOKIE_NAMES,
} from "@/organizations/auth/cookie-names";
import { getOIDCConfig, getRedirectUri } from "@/organizations/auth/oidc";

const logger = createLogger({ service: "auth-web" }).child({
  route: "api.auth.login",
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
// ENTRY POINT — open a trace scope, hand off to the request handler
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const traceId = randomUUID().slice(0, 8);
  return requestContext.run({ traceId }, () => handleRequest(request));
}

async function handleRequest(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();

  // --- REQUEST bookend ---
  logRequest(request);

  // --- Dispatch: only one scenario on this route ---
  try {
    const response = await handleScenarioA_StartLoginTransaction(request);

    // --- RESPONSE bookend ---
    logResponse(response, { scenario: "A", startedAt });
    return response;
  } catch (error) {
    // Let the error propagate so Next.js still responds with 500, but
    // log it explicitly so the trace has a clear tail. Without this,
    // you'd see a REQUEST log with no matching RESPONSE — solvable but
    // slower to debug.
    logError("Scenario A: unhandled error", {
      error,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO A — Start an organizations OIDC login transaction
// ═══════════════════════════════════════════════════════════════════════════
/*
 * WHO LANDS HERE
 *   The browser. Either the user clicked a "sign in to organizations"
 *   link, or middleware bounced an unauthenticated request to this route.
 *
 * REQUEST SHAPE
 *   GET /api/auth/login
 *   GET /api/auth/login?returnTo=/some/relative/path   (optional)
 *
 * WHAT THE BROWSER EXPECTS FROM US
 *   A 302 redirect to the OIDC provider's authorize endpoint, PLUS three
 *   encrypted cookies carrying the PKCE verifier, OAuth state, and the
 *   returnTo path. The callback route will decrypt those cookies, verify
 *   the `state` echoed back, swap the auth code for tokens, and land the
 *   user at `returnTo`.
 *
 * POSSIBLE OUTCOMES
 *   ┌───────────────────────────────────┬─────────────────────────────────┐
 *   │ Condition                         │ What we return                  │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ All good                          │ 302 authorization URL           │
 *   │                                   │ + 3 OIDC cookies set            │
 *   │                                   │ + logged-out marker cleared     │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ OIDC config / crypto throws       │ error propagates → Next.js 500  │
 *   │                                   │ (logged via the outer catch)    │
 *   └───────────────────────────────────┴─────────────────────────────────┘
 *
 * Five numbered steps below — read top-to-bottom for the mechanics.
 */
async function handleScenarioA_StartLoginTransaction(
  request: NextRequest
): Promise<NextResponse> {
  // Step 1: load the OIDC provider config (issuer metadata + client creds).
  const config = await getOIDCConfig();
  logInfo("OIDC config loaded");

  // Step 2: create a fresh login transaction — random `state`, PKCE
  // verifier/challenge, and a sanitized `returnTo`. All three get
  // persisted in encrypted cookies later so the callback can verify them.
  const transaction = await createLoginTransaction({
    requestedReturnTo: request.nextUrl.searchParams.get("returnTo"),
    defaultReturnTo: "/organizations",
  });
  logInfo("Login transaction created", {
    returnTo: transaction.returnTo,
    stateLength: transaction.state.length,
    codeChallengeLength: transaction.codeChallenge.length,
  });

  // Step 3: build the URL we'll redirect the browser to. `prompt=login`
  // forces the IdP to re-authenticate (never silent-SSO this flow), and
  // `max_age=0` is a belt-and-braces way to say "treat any cached auth
  // as stale".
  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: getRedirectUri(),
    scope: buildScope(
      ["openid", "profile", "email"],
      process.env.OIDC_ADDITIONAL_SCOPES || "offline_access"
    ),
    code_challenge: transaction.codeChallenge,
    code_challenge_method: "S256",
    state: transaction.state,
    prompt: "login",
    max_age: "0",
  });
  logInfo("Authorization URL built", {
    authorizationHost: authorizationUrl.host,
    authorizationPath: authorizationUrl.pathname,
  });

  // Step 4: prepare the response and persist the transaction into
  // encrypted cookies. These cookies are what makes the callback handler
  // able to verify the response.
  const response = NextResponse.redirect(authorizationUrl.href);

  await persistOIDCTransaction({
    cookies: response.cookies,
    encrypt,
    cookieNames: AUTH_ORG_OIDC_COOKIE_NAMES,
    transaction,
  });
  logInfo("OIDC transaction cookies persisted");

  // Step 5: clear the "user just logged out" marker if it was set.
  // We're starting a fresh login, so the marker is stale.
  clearLoggedOutMarker(response.cookies, AUTH_ORG_OIDC_COOKIE_NAMES.loggedOut);
  logInfo("Logged-out marker cleared");

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
    query: Object.fromEntries(request.nextUrl.searchParams.entries()),
    cookiesPresent: {
      // The marker is set by the logout flow; its presence means the last
      // user on this browser explicitly signed out (Step 5 will clear it).
      loggedOutMarker: cookieHeader.includes(AUTH_ORG_LOGGED_OUT_COOKIE),
    },
    userAgent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
  });
}

/**
 * Log the outgoing response in one consolidated entry. Captures HTTP
 * status, redirect target, and any cookies being set/cleared (the
 * wire-level truth, regardless of which helper applied them).
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

  // Mask the authorization URL — it's public-ish (the browser sees it)
  // but contains the state and code_challenge we just generated. Log
  // host + path instead of the full URL.
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
