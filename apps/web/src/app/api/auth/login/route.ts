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
 *    4. Builds Hydra's /oauth2/auth URL with fresh-login OIDC prompts.
 *    5. Redirects the browser to Hydra.
 *
 *  @see `/api/auth/callback`                              — exchanges the code
 *  @see `auth/web/src/app/oauth/login/route.ts`           — Hydra login side
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
// ENTRY POINT — start a fresh login transaction
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const traceId = randomUUID().slice(0, 8);
  return requestContext.run({ traceId }, () => handleRequest(request));
}

async function handleRequest(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();

  // --- REQUEST bookend ---
  logHttpRequest(logger, request, {
    root: rootContext(),
  });

  try {
    const response = await processLoginTransaction(request);
    logHttpResponse(logger, response, {
      startedAt,
      root: rootContext(),
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
// SHARED: the login-transaction dance
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Five numbered steps:
 *   1. Load OIDC config + redirect URI.
 *   2. Create the login transaction (PKCE material, state, sanitized returnTo).
 *   3. Build the Hydra authorization URL with forced re-auth.
 *   4. Persist the transaction into encrypted cookies for the callback.
 *   5. Clear the logged-out marker (we're starting fresh).
 *
 * `prompt=login` and `max_age=0` keep each client-initiated login fresh.
 */
async function processLoginTransaction(request: NextRequest): Promise<NextResponse> {
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

  // Step 3: build the authorization URL and force a full login screen.
  const authorizationParams: Record<string, string> = {
    redirect_uri: redirectUri,
    scope,
    code_challenge: transaction.codeChallenge,
    code_challenge_method: "S256",
    state: transaction.state,
    prompt: "login",
    max_age: "0",
  };

  const authorizationUrl = client.buildAuthorizationUrl(
    config,
    authorizationParams
  );
  logInfo("Authorization URL built", {
    authorizationHost: authorizationUrl.host,
    authorizationPath: authorizationUrl.pathname,
    forceFreshAuth: true,
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
