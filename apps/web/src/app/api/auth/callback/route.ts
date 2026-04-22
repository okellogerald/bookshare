/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  OAuth2 Callback — Web App (Authorization Code Exchange)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  This handler finishes the OAuth2 Authorization-Code + PKCE flow that was
 *  started at /api/auth/login. The browser is bouncing back from Hydra with
 *  an authorization `code` and the original `state`; our job is to swap the
 *  code for tokens, establish a Web session, and hand control to the
 *  Auth-Portal resolver so the user ends up on the right first-party client.
 *
 *  ┌──────────────┬──────────────────────────────────┬─────────────────────┐
 *  │ Scenario     │ Who calls                         │ How we know         │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ A — RETURN   │ The browser, bouncing back from   │ Transaction cookies │
 *  │              │ Hydra after the user completed    │ (codeVerifier,      │
 *  │              │ (or cancelled) login + consent.   │ state, returnTo)    │
 *  │              │                                    │ are present and     │
 *  │              │                                    │ decrypt cleanly.    │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ B — ORPHAN   │ The browser, but the transaction  │ No valid transaction│
 *  │              │ cookies are missing or unreadable │ cookies — usually a │
 *  │              │ (expired, cleared, cross-tab      │ cross-tab race or a │
 *  │              │ collision, stale bookmark).       │ refresh after the   │
 *  │              │                                    │ flow completed.     │
 *  └──────────────┴──────────────────────────────────┴─────────────────────┘
 *
 *  @see `../login/route.ts`                               — sets the transaction
 *  @see `@/domains/auth/lib/session`                      — where session cookies land
 *  @see `@/domains/auth/lib/auth-portal#buildAuthPortalResolveUrl`
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { NextRequest, NextResponse } from "next/server";
import {
  clearOIDCClientCookies,
  clearOIDCTransactionCookies,
  readOIDCTransaction,
} from "@bookshare/shared";
import { createLogger, redactValue, truncateForLog } from "@bookshare/logger";
import * as client from "openid-client";
import { getOIDCConfig } from "@/domains/auth/lib/oidc";
import { setSession } from "@/domains/auth/lib/session";
import { decrypt } from "@/domains/auth/lib/crypto";
import { WEB_OIDC_COOKIE_NAMES } from "@/domains/auth/lib/cookie-names";
import { buildAuthPortalResolveUrl } from "@/domains/auth/lib/auth-portal";

const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://api:3333/api";

const logger = createLogger({ service: "web-auth" }).child({
  route: "api.auth.callback",
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

  // Load the OIDC config and try to recover the login transaction we stored
  // back in /api/auth/login. If the transaction cookies are missing or
  // corrupt, `readOIDCTransaction` returns null — that's Scenario B.
  const config = await getOIDCConfig();
  const transaction = await readOIDCTransaction({
    cookies: request.cookies,
    decrypt,
    cookieNames: WEB_OIDC_COOKIE_NAMES,
    defaultReturnTo: "/browse",
  });

  // --- REQUEST bookend ---
  logRequest(request, { transactionPresent: Boolean(transaction) });

  // --- Dispatch: exactly one of these two runs ---
  let scenario: "A" | "B";
  let response: NextResponse;

  if (transaction) {
    scenario = "A";
    response = await handleScenarioA_CallbackReturn(request, config, transaction);
  } else {
    scenario = "B";
    response = handleScenarioB_OrphanedCallback(request);
  }

  // --- RESPONSE bookend ---
  logResponse(response, { scenario, startedAt });
  return response;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO A — Browser returning with a valid transaction
// ═══════════════════════════════════════════════════════════════════════════
/*
 * WHO LANDS HERE
 *   The browser, coming back from Hydra. It has `?code=` and `?state=` on
 *   the URL AND still has the three transaction cookies (codeVerifier,
 *   state, returnTo) we set back in /api/auth/login.
 *
 * REQUEST SHAPE
 *   GET /api/auth/callback?code=<opaque>&state=<opaque>
 *   Cookies: oidc_code_verifier, oidc_state, oidc_return_to (all encrypted)
 *
 * WHAT THE BROWSER EXPECTS FROM US
 *   Swap the code for ID + access tokens, verify the user's email is
 *   verified, establish a session, call the API's /profiles/sync to upsert
 *   the profile row, and redirect to the Auth-Portal resolver so the user
 *   can land on whichever first-party client `returnTo` pointed at. On any
 *   failure, clear the partial state and send them somewhere sane.
 *
 * POSSIBLE OUTCOMES
 *   ┌───────────────────────────────────┬─────────────────────────────────┐
 *   │ Condition                         │ What we return                  │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ Exchange OK + email verified +    │ 302 auth-portal /resolve(       │
 *   │ profile sync OK (or non-fatal     │   returnTo)                     │
 *   │ failure)                          │ + session cookies set           │
 *   │                                   │ + transaction cookies cleared   │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ Exchange OK + email NOT verified  │ 302 /auth/verification          │
 *   │                                   │ + all OIDC cookies cleared      │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ Exchange OK + profile sync 401    │ 302 /?error=account_deactivated │
 *   │ "deactivated"                     │ + all OIDC cookies cleared      │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ Exchange failed (state mismatch,  │ 302 /?error=auth_failed         │
 *   │ expired code, provider rejected,  │ + all OIDC cookies cleared      │
 *   │ network error, etc.)              │                                 │
 *   └───────────────────────────────────┴─────────────────────────────────┘
 *
 * Each outcome lives as an early-return and does its own cookie cleanup.
 */
async function handleScenarioA_CallbackReturn(
  request: NextRequest,
  config: client.Configuration,
  transaction: NonNullable<Awaited<ReturnType<typeof readOIDCTransaction>>>
): Promise<NextResponse> {
  // --- Step 1: Token exchange ---
  // Call Hydra's /token endpoint with the authorization code + PKCE
  // verifier. `openid-client` also verifies `state` matches `expectedState`
  // and validates the returned ID token.
  let tokens: Awaited<ReturnType<typeof client.authorizationCodeGrant>>;
  try {
    tokens = await client.authorizationCodeGrant(config, new URL(request.url), {
      pkceCodeVerifier: transaction.codeVerifier,
      expectedState: transaction.expectedState,
      idTokenExpected: true,
    });
    logInfo("Token exchange succeeded", {
      hasIdToken: Boolean(tokens.id_token),
      hasAccessToken: Boolean(tokens.access_token),
    });
  } catch (error) {
    // --- Outcome 4: exchange failed ---
    logError("Scenario A: token exchange failed", { error });
    const response = NextResponse.redirect(
      new URL("/?error=auth_failed", request.url)
    );
    clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
    logInfo("OIDC cookies cleared (exchange failure)");
    return response;
  }

  // --- Step 2: inspect claims ---
  const claims = tokens.claims()!;
  const subject = claims.sub ?? null;
  const emailVerified = toBoolean(claims.email_verified);

  logInfo("ID token claims resolved", {
    subject,
    emailPresent: typeof claims.email === "string",
    emailVerified,
  });

  // --- Outcome 2: email not verified → bounce to verification ---
  if (!emailVerified) {
    logInfo("Email not verified → redirecting to /auth/verification", {
      subject,
    });
    const response = NextResponse.redirect(
      new URL("/auth/verification", request.url)
    );
    clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
    logInfo("OIDC cookies cleared (email unverified)");
    return response;
  }

  // --- Step 3: establish the Web session ---
  // Note: setSession() uses Next's ambient `cookies()` API to write the two
  // session cookies, so they WON'T show up in the RESPONSE log's cookie
  // list. We log them explicitly here so the trace is honest.
  await setSession(
    {
      idToken: tokens.id_token,
      expiresAt: claims.exp ?? Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: claims.sub,
        email: claims.email as string | undefined,
        name: claims.name as string | undefined,
        username: claims.preferred_username as string | undefined,
        emailVerified,
      },
    },
    tokens.access_token
  );
  logInfo("Web session persisted (ambient cookies)", {
    subject,
    cookiesSet: ["bookshare_session", "bookshare_token"],
  });

  // --- Step 4: sync the profile row with the API (best-effort) ---
  // The API may reject a deactivated user — that's the one hard failure we
  // need to surface. Any other sync failure is logged but non-fatal.
  const apiToken = resolveApiToken(tokens.access_token, tokens.id_token);
  const syncResult = apiToken
    ? await syncProfile(apiToken, subject)
    : { kind: "skipped" as const };

  if (syncResult.kind === "deactivated") {
    // --- Outcome 3: account deactivated ---
    logInfo("Profile sync reported deactivated account → redirecting home", {
      subject,
    });
    const response = NextResponse.redirect(
      new URL("/?error=account_deactivated", request.url)
    );
    clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
    logInfo("OIDC cookies cleared (account deactivated)");
    return response;
  }

  // --- Outcome 1: happy path — resolve via auth-portal ---
  const response = NextResponse.redirect(
    buildAuthPortalResolveUrl(transaction.returnTo)
  );
  // Session is set — we only need to clear the transaction cookies now.
  clearOIDCTransactionCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
  logInfo("Transaction cookies cleared (successful login)", {
    subject,
    returnTo: transaction.returnTo,
    syncResult: syncResult.kind,
  });
  return response;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO B — Orphaned callback (no valid transaction)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * WHO LANDS HERE
 *   The browser, but without usable transaction cookies. Common causes:
 *     - Transaction cookies expired (they're short-lived).
 *     - User opened two login flows in two tabs; one raced the other.
 *     - User hit a stale bookmark of the callback URL.
 *     - Browser/extension cleared cookies mid-flow.
 *
 * REQUEST SHAPE
 *   GET /api/auth/callback?code=...&state=...   (the query is usually
 *   still there, but we can't verify it without the PKCE verifier)
 *
 * WHAT WE RETURN
 *   302 back to /api/auth/login so the user can start a fresh transaction.
 *   No cookies to clear — none were valid to begin with.
 */
function handleScenarioB_OrphanedCallback(request: NextRequest): NextResponse {
  logInfo("Scenario B: missing OIDC transaction → restart from /api/auth/login");
  return NextResponse.redirect(new URL("/api/auth/login", request.url));
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: profile sync with the NestJS API
// ═══════════════════════════════════════════════════════════════════════════

type SyncResult =
  | { kind: "ok" }
  | { kind: "deactivated" }
  | { kind: "failed" }
  | { kind: "skipped" };

/**
 * POST /profiles/sync — upserts the profile row for this user. Best-effort:
 * the only outcome we propagate back is "deactivated" (401 + body mentions
 * "deactivated"), which the caller turns into a hard redirect. Everything
 * else is logged and treated as non-fatal.
 */
async function syncProfile(
  apiToken: string,
  subject: string | null
): Promise<SyncResult> {
  try {
    const syncResponse = await fetch(`${API_URL}/profiles/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (syncResponse.ok) {
      logInfo("Profile sync succeeded", { subject });
      return { kind: "ok" };
    }

    const body = await syncResponse.text();
    if (
      syncResponse.status === 401 &&
      body.toLowerCase().includes("deactivated")
    ) {
      logInfo("Profile sync rejected — account deactivated", {
        subject,
        status: 401,
      });
      return { kind: "deactivated" };
    }

    logError("Profile sync failed (non-fatal)", {
      subject,
      status: syncResponse.status,
      body: truncateForLog(body),
    });
    return { kind: "failed" };
  } catch (error) {
    logError("Profile sync request threw (non-fatal)", { subject, error });
    return { kind: "failed" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: claim + token readers
// ═══════════════════════════════════════════════════════════════════════════

/** Coerce an arbitrary claim value into a boolean (handles "true" strings). */
function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function isJwtLike(token?: string | null): token is string {
  return !!token && token.split(".").length === 3;
}

/** Prefer a JWT access token; fall back to ID token; finally raw string. */
function resolveApiToken(
  accessToken?: string | null,
  idToken?: string | null
) {
  if (isJwtLike(accessToken)) return accessToken;
  if (isJwtLike(idToken)) return idToken;
  return accessToken ?? idToken ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST / RESPONSE BOOKEND LOGGERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log the incoming request in one consolidated entry. Grep by `traceId`
 * to find this plus every downstream log for the same request.
 */
function logRequest(
  request: NextRequest,
  ctx: { transactionPresent: boolean }
) {
  logInfo("REQUEST", {
    method: request.method,
    url: new URL(request.url).pathname, // drop query — it's redacted below
    path: request.nextUrl.pathname,
    query: redactQueryParams(request.nextUrl.searchParams),
    transactionPresent: ctx.transactionPresent,
    userAgent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
  });
}

/**
 * Log the outgoing response in one consolidated entry. Captures HTTP
 * status, redirect target, and any cookies being set/cleared via
 * `response.cookies` (note: the happy path's session cookies go via
 * Next's ambient `cookies()` and are logged separately in Scenario A).
 */
function logResponse(
  response: NextResponse,
  ctx: { scenario: "A" | "B"; startedAt: number }
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

  logInfo("RESPONSE", {
    scenario: ctx.scenario,
    status: response.status,
    location: response.headers.get("location"),
    cookies: cookieActions,
    durationMs: Date.now() - ctx.startedAt,
  });
}

/**
 * Copy the request query string for logging, redacting anything that's
 * sensitive or useless at full value. `code` and `state` are one-time-use
 * but we still redact them so logs stay out of incident-response paths.
 */
function redactQueryParams(params: URLSearchParams): Record<string, string> {
  const SENSITIVE = new Set(["code", "state", "id_token", "access_token"]);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (SENSITIVE.has(key)) {
      out[key] = redactValue(value) ?? "";
    } else {
      out[key] = value;
    }
  }
  return out;
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
