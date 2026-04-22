/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Organizations OAuth Callback — Auth-Portal
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  This handler finishes the OIDC login transaction that was started at
 *  /api/auth/login. The browser is bouncing back from the OIDC provider
 *  carrying an authorization `code` and the original `state`; our job is
 *  to swap the code for tokens and establish an organization session.
 *
 *  ┌──────────────┬──────────────────────────────────┬─────────────────────┐
 *  │ Scenario     │ Who calls                         │ How we know         │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ A — RETURN   │ The browser, bouncing back from   │ Transaction cookies │
 *  │              │ the OIDC provider after the user  │ (codeVerifier,      │
 *  │              │ completed (or cancelled) the      │ state, returnTo)    │
 *  │              │ authorization step.               │ are present and     │
 *  │              │                                    │ decrypt cleanly.    │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ B — ORPHAN   │ The browser, but the transaction  │ No valid transaction│
 *  │              │ cookies are missing or unreadable │ cookies — usually a │
 *  │              │ (expired, cleared, cross-tab      │ cross-tab race or a │
 *  │              │ collision, stale bookmark).       │ refresh after the   │
 *  │              │                                    │ flow completed.     │
 *  └──────────────┴──────────────────────────────────┴─────────────────────┘
 *
 *  @see `../login/route.ts` — sets the transaction cookies this reads
 *  @see `@/organizations/auth/session` — where the session cookies land
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
import { createLogger, redactValue } from "@bookshare/logger";
import * as client from "openid-client";
import { decrypt } from "@/organizations/auth/crypto";
import { AUTH_ORG_OIDC_COOKIE_NAMES } from "@/organizations/auth/cookie-names";
import { getOIDCConfig } from "@/organizations/auth/oidc";
import { setOrganizationSession } from "@/organizations/auth/session";

const logger = createLogger({ service: "auth-web" }).child({
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
    cookieNames: AUTH_ORG_OIDC_COOKIE_NAMES,
    defaultReturnTo: "/organizations",
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
 *   The browser, coming back from the OIDC provider. It has the `?code=`
 *   and `?state=` query params on the URL AND it still has the three
 *   transaction cookies (codeVerifier, state, returnTo) we set back in
 *   /api/auth/login.
 *
 * REQUEST SHAPE
 *   GET /api/auth/callback?code=<opaque>&state=<opaque>
 *   Cookies: auth_org_oidc_code_verifier, auth_org_oidc_state,
 *            auth_org_oidc_return_to (all encrypted)
 *
 * WHAT THE BROWSER EXPECTS FROM US
 *   Swap the code for ID + access tokens, verify the user's email is
 *   verified, establish a session, and redirect to the returnTo path.
 *   On any failure, clear the partial state and send them somewhere sane.
 *
 * POSSIBLE OUTCOMES
 *   ┌───────────────────────────────────┬─────────────────────────────────┐
 *   │ Condition                         │ What we return                  │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ Token exchange + email verified   │ 302 to transaction.returnTo     │
 *   │                                   │ + session cookies set           │
 *   │                                   │ + transaction cookies cleared   │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ Token exchange OK, email NOT      │ 302 /verification               │
 *   │ verified                          │ + all OIDC cookies cleared      │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ Token exchange failed (state      │ 302 /organizations              │
 *   │ mismatch, expired code, provider  │     ?error=auth_failed          │
 *   │ rejected, network error, etc.)    │ + all OIDC cookies cleared      │
 *   └───────────────────────────────────┴─────────────────────────────────┘
 *
 * The three outcomes live as three early-returns inside the function —
 * each exit path is self-contained and does its own cookie cleanup.
 */
async function handleScenarioA_CallbackReturn(
  request: NextRequest,
  config: client.Configuration,
  transaction: NonNullable<Awaited<ReturnType<typeof readOIDCTransaction>>>
): Promise<NextResponse> {
  // --- Token exchange ---
  // Call the provider's /token endpoint with the authorization code
  // and PKCE verifier. `openid-client` also verifies the `state` matches
  // `expectedState` and validates the returned ID token.
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
    // --- Outcome 3: exchange failed ---
    logError("Scenario A: token exchange failed", { error });
    const response = NextResponse.redirect(
      new URL("/organizations?error=auth_failed", request.url)
    );
    clearOIDCClientCookies(response.cookies, AUTH_ORG_OIDC_COOKIE_NAMES);
    logInfo("OIDC cookies cleared (exchange failure)");
    return response;
  }

  // --- Post-exchange: inspect claims ---
  const claims = tokens.claims()!;
  const subject = claims.sub ?? null;
  const emailVerified = toBoolean(claims.email_verified);
  const roles = extractRoles(claims as Record<string, unknown>);

  logInfo("ID token claims resolved", {
    subject,
    emailPresent: typeof claims.email === "string",
    emailVerified,
    roleCount: roles.length,
    roles,
  });

  // --- Outcome 2: email not verified → bounce to verification ---
  if (!emailVerified) {
    logInfo("Email not verified → redirecting to /verification", { subject });
    const response = NextResponse.redirect(
      new URL("/verification", request.url)
    );
    clearOIDCClientCookies(response.cookies, AUTH_ORG_OIDC_COOKIE_NAMES);
    logInfo("OIDC cookies cleared (email unverified)");
    return response;
  }

  // --- Outcome 1: happy path — establish session and land on returnTo ---

  // Note: setOrganizationSession uses Next's ambient `cookies()` API to
  // write the two session cookies, so they WON'T show up in the RESPONSE
  // log's cookie list. We log them explicitly here so the trace is honest.
  await setOrganizationSession(
    {
      idToken: tokens.id_token,
      expiresAt: claims.exp ?? Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: claims.sub,
        email: claims.email as string | undefined,
        name: claims.name as string | undefined,
        username: claims.preferred_username as string | undefined,
        emailVerified,
        roles,
      },
    },
    tokens.access_token
  );
  logInfo("Organization session persisted (ambient cookies)", {
    subject,
    cookiesSet: ["auth_org_session", "auth_org_token"],
  });

  const response = NextResponse.redirect(
    new URL(transaction.returnTo, request.url)
  );
  // Session is set — we only need to clear the transaction cookies now.
  clearOIDCTransactionCookies(response.cookies, AUTH_ORG_OIDC_COOKIE_NAMES);
  logInfo("Transaction cookies cleared (successful login)", {
    subject,
    returnTo: transaction.returnTo,
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
// HELPER: claim readers
// ═══════════════════════════════════════════════════════════════════════════

/** Coerce an arbitrary claim value into a boolean (handles "true" strings). */
function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

/** Extract the `roles` array from ID-token claims, filtering non-strings. */
function extractRoles(claims: Record<string, unknown>): string[] {
  if (!Array.isArray(claims.roles)) return [];
  return claims.roles.filter(
    (value): value is string => typeof value === "string"
  );
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
