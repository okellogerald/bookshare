/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  OAuth2 Login Initiation — Web App (Client of Hydra)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  This handler answers ONE question: "can you send me into the OAuth flow
 *  so I can sign in to the Web app?"
 *
 *  This route is the Web app acting as an OAuth *client* to Hydra. It kicks
 *  off an Authorization-Code + PKCE flow:
 *
 *    1. Generates PKCE material (code_verifier → code_challenge) + `state`.
 *    2. Encrypts the verifier / state / returnTo into short-lived cookies
 *       (the callback route consumes them to finalize the exchange).
 *    3. Clears any "you just logged out" marker so the middleware doesn't
 *       loop the user back to the landing page.
 *    4. Builds Hydra's /oauth2/auth URL with the right OIDC prompts.
 *    5. Redirects the browser to Hydra.
 *
 *  ┌──────────────┬──────────────────────────────────┬─────────────────────┐
 *  │ Scenario     │ Who calls                         │ How we know         │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ A — NORMAL   │ A user clicking "sign in", or     │ No ?handoff=1 on    │
 *  │              │ middleware bouncing an unauth'd   │ the query string    │
 *  │              │ request here. We force a full     │                     │
 *  │              │ login screen (prompt=login,       │                     │
 *  │              │ max_age=0) — the browser has no   │                     │
 *  │              │ session we trust.                 │                     │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ B — HANDOFF  │ Auth-Portal's                     │ ?handoff=1          │
 *  │              │ resolveLoginDestination() just    │                     │
 *  │              │ moved a freshly-authenticated     │                     │
 *  │              │ user from one first-party client  │                     │
 *  │              │ to this one. We skip prompt=login │                     │
 *  │              │ so the existing Kratos session is │                     │
 *  │              │ reused — no second password entry.│                     │
 *  └──────────────┴──────────────────────────────────┴─────────────────────┘
 *
 *  @see `/api/auth/callback`                              — exchanges the code
 *  @see `auth/web/src/app/oauth/login/route.ts`           — Hydra login side
 *  @see `auth/web/src/shared/lib/login-destination.ts`    — emits ?handoff=1
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
import {
  createLogger,
  logHttpRequest,
  logHttpResponse,
} from "@bookshare/logger";
import * as client from "openid-client";
import { getOIDCConfig, getRedirectUri } from "@/domains/auth/lib/oidc";
import { encrypt } from "@/domains/auth/lib/crypto";
import { WEB_OIDC_COOKIE_NAMES } from "@/domains/auth/lib/cookie-names";

const logger = createLogger({ service: "web-auth" }).child({
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
// ENTRY POINT — classify the request, hand off to the right scenario
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const traceId = randomUUID().slice(0, 8);
  return requestContext.run({ traceId }, () => handleRequest(request));
}

async function handleRequest(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();

  const isResolverHandoff =
    request.nextUrl.searchParams.get("handoff") === "1";

  // --- REQUEST bookend ---
  logHttpRequest(logger, request, {
    root: rootContext(),
    context: { resolverHandoff: isResolverHandoff },
  });

  // --- Dispatch: exactly one of these two runs ---
  let scenario: "A" | "B";
  let response: NextResponse;
  try {
    if (isResolverHandoff) {
      scenario = "B";
      response = await handleScenarioB_ResolverHandoff(request);
    } else {
      scenario = "A";
      response = await handleScenarioA_NormalLogin(request);
    }
    logHttpResponse(logger, response, {
      startedAt,
      root: rootContext(),
      context: { scenario },
    });
    return response;
  } catch (error) {
    logError("Unhandled error during login initiation", {
      error,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO A — Normal login (force a fresh auth screen)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * WHO LANDS HERE
 *   A user clicking "sign in", or the middleware redirecting an
 *   unauthenticated request to this route. We can't trust any existing
 *   Kratos session, so we tell Hydra "show them the login screen".
 *
 * REQUEST SHAPE
 *   GET /api/auth/login
 *   GET /api/auth/login?returnTo=/some/relative/path    (optional)
 *
 * WHAT THE BROWSER EXPECTS FROM US
 *   A 307 to Hydra's /oauth2/auth endpoint with the PKCE challenge,
 *   `state`, and `prompt=login max_age=0` (belt-and-braces "ignore any
 *   cached auth"). Also the three transient cookies so the callback
 *   route can verify the response.
 *
 * POSSIBLE OUTCOMES
 *   ┌───────────────────────────────────┬─────────────────────────────────┐
 *   │ Condition                         │ What we return                  │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ All good                          │ 307 Hydra authorize URL         │
 *   │                                   │ + 3 OIDC cookies set            │
 *   │                                   │ + logged-out marker cleared     │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ OIDC config / crypto throws       │ error propagates → Next.js 500  │
 *   │                                   │ (logged via the outer catch)    │
 *   └───────────────────────────────────┴─────────────────────────────────┘
 */
async function handleScenarioA_NormalLogin(
  request: NextRequest
): Promise<NextResponse> {
  return processLoginTransaction(request, { forceFreshAuth: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO B — Resolver handoff (reuse existing Kratos session)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * WHO LANDS HERE
 *   Auth-Portal's resolveLoginDestination() routine. The user just
 *   completed a successful login on a *different* first-party client
 *   (Admin, Bookstores, or Auth-Portal itself) and the resolver decided
 *   the Web app is where they should actually land. Re-prompting for
 *   credentials would be rude — the Kratos session is fresh and valid.
 *
 * REQUEST SHAPE
 *   GET /api/auth/login?handoff=1
 *   GET /api/auth/login?handoff=1&returnTo=/some/path
 *
 * WHAT THE BROWSER EXPECTS FROM US
 *   A 307 to Hydra's /oauth2/auth endpoint — BUT without prompt=login,
 *   so Hydra's login challenge handler can short-circuit via its
 *   "skip" fast-path using the existing session. Same three transient
 *   cookies as Scenario A.
 *
 * POSSIBLE OUTCOMES
 *   Same as Scenario A (success → 307, error → 500). The only thing that
 *   changes is whether the Hydra URL carries prompt/max_age.
 */
async function handleScenarioB_ResolverHandoff(
  request: NextRequest
): Promise<NextResponse> {
  return processLoginTransaction(request, { forceFreshAuth: false });
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED: the login-transaction dance used by both scenarios
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Five numbered steps:
 *   1. Load OIDC config + redirect URI.
 *   2. Create the login transaction (PKCE material, state, sanitized returnTo).
 *   3. Build the Hydra authorization URL (with or without forced re-auth).
 *   4. Persist the transaction into encrypted cookies for the callback.
 *   5. Clear the logged-out marker (we're starting fresh).
 *
 * `forceFreshAuth=true` adds prompt=login and max_age=0 to the URL — used
 * by Scenario A. Scenario B omits both, letting Hydra's skip path kick in.
 */
async function processLoginTransaction(
  request: NextRequest,
  opts: { forceFreshAuth: boolean }
): Promise<NextResponse> {
  // Step 1: discover Hydra's OIDC metadata.
  const config = await getOIDCConfig();
  const redirectUri = getRedirectUri();
  logInfo("OIDC config loaded", { redirectUri });

  // Step 2: create a fresh login transaction.
  const scope = buildScope(
    ["openid", "profile", "email"],
    process.env.OIDC_ADDITIONAL_SCOPES || "offline_access"
  );
  const transaction = await createLoginTransaction({
    requestedReturnTo: request.nextUrl.searchParams.get("returnTo"),
    defaultReturnTo: "/browse",
  });
  logInfo("Login transaction created", {
    returnTo: transaction.returnTo,
    scope,
    stateLength: transaction.state.length,
    codeChallengeLength: transaction.codeChallenge.length,
  });

  // Step 3: build the authorization URL. Scenario A forces a full login
  // screen; Scenario B omits those so Hydra can reuse the session.
  const authorizationParams: Record<string, string> = {
    redirect_uri: redirectUri,
    scope,
    code_challenge: transaction.codeChallenge,
    code_challenge_method: "S256",
    state: transaction.state,
  };
  if (opts.forceFreshAuth) {
    authorizationParams.prompt = "login";
    authorizationParams.max_age = "0";
  }

  const authorizationUrl = client.buildAuthorizationUrl(
    config,
    authorizationParams
  );
  logInfo("Authorization URL built", {
    authorizationHost: authorizationUrl.host,
    authorizationPath: authorizationUrl.pathname,
    forceFreshAuth: opts.forceFreshAuth,
  });

  // Step 4: prepare the response and persist the transaction cookies.
  const response = NextResponse.redirect(authorizationUrl.href);
  await persistOIDCTransaction({
    cookies: response.cookies,
    encrypt,
    cookieNames: WEB_OIDC_COOKIE_NAMES,
    transaction,
  });
  logInfo("OIDC transaction cookies persisted");

  // Step 5: clear the "user just logged out" marker.
  clearLoggedOutMarker(response.cookies, WEB_OIDC_COOKIE_NAMES.loggedOut);
  logInfo("Logged-out marker cleared");

  return response;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: logging primitives (read traceId from AsyncLocalStorage)
// ═══════════════════════════════════════════════════════════════════════════

/** Root-level fields that should appear on every log line for this request. */
function rootContext(): Record<string, unknown> {
  return { ...(requestContext.getStore() ?? {}) };
}

function logInfo(event: string, data?: Record<string, unknown>) {
  logger.info({ ...(data ?? {}), ...rootContext() }, event);
}

function logError(event: string, data?: Record<string, unknown>) {
  const { error, ...rest } = data ?? {};
  logger.error({ ...rest, ...rootContext(), err: error }, event);
}
