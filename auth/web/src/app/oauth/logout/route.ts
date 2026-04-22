/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Hydra Logout Challenge Handler — Auth-Portal (Phase 2 of 3)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  This handler answers ONE question: "is Hydra allowed to invalidate this
 *  OAuth session?" For first-party apps the answer is always yes — there's
 *  no user confirmation — so the work here is essentially a rubber stamp.
 *
 *  Where this sits in the overall logout flow:
 *
 *  ┌───────┬──────────────────────────────────────────────────────────────┐
 *  │ Phase │ Responsibility                                                │
 *  ├───────┼──────────────────────────────────────────────────────────────┤
 *  │   1   │ Client app kicks off RP-initiated logout.                     │
 *  │       │ → apps/*\/src/app/api/auth/logout/route.ts                    │
 *  ├───────┼──────────────────────────────────────────────────────────────┤
 *  │   2   │ THIS FILE. Hydra created a logout challenge and redirected    │
 *  │       │ the browser here. We accept it via Hydra admin API; Hydra     │
 *  │       │ then invalidates its OAuth session and hands us a             │
 *  │       │ post-logout redirect URL.                                     │
 *  ├───────┼──────────────────────────────────────────────────────────────┤
 *  │   3   │ Auth-Portal's /logout page clears the Kratos session.         │
 *  └───────┴──────────────────────────────────────────────────────────────┘
 *
 *  Scenarios:
 *
 *  ┌──────────────┬──────────────────────────────────┬─────────────────────┐
 *  │ Scenario     │ Who calls                         │ How we know         │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ A — ACCEPT   │ Hydra, after the client           │ ?logout_challenge=  │
 *  │              │ initiated logout in Phase 1.      │ in query string     │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ B — INVALID  │ Anyone hitting the endpoint with  │ no challenge in     │
 *  │              │ no challenge (bot, stale link,    │ query string        │
 *  │              │ misconfiguration).                │                     │
 *  └──────────────┴──────────────────────────────────┴─────────────────────┘
 *
 *  @see `apps/*\/src/app/api/auth/logout/route.ts` — Phase 1
 *  @see `auth/web/src/app/logout/...`             — Phase 3
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { NextRequest, NextResponse } from "next/server";
import { createLogger, redactValue } from "@bookshare/logger";
import { getAuthPortalPublicUrl } from "@/shared/lib/config";
import { hydraAdminRequest } from "@/shared/lib/hydra";

const logger = createLogger({ service: "auth-web" }).child({
  route: "oauth.logout",
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

  const challenge = request.nextUrl.searchParams
    .get("logout_challenge")
    ?.trim();

  // --- REQUEST bookend ---
  logRequest(request, { challenge });

  // --- Dispatch: exactly one of these two runs ---
  let scenario: "A" | "B";
  let response: NextResponse;

  if (challenge) {
    scenario = "A";
    response = await handleScenarioA_LogoutChallenge(challenge);
  } else {
    scenario = "B";
    response = handleScenarioB_MissingChallenge();
  }

  // --- RESPONSE bookend ---
  logResponse(response, { scenario, startedAt });
  return response;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO A — Hydra logout challenge (the only real flow)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * WHO LANDS HERE
 *   Hydra. A client app ran Phase 1 of logout, so Hydra generated a logout
 *   challenge and 302'd the browser here asking us to confirm.
 *
 * REQUEST SHAPE
 *   GET /oauth/logout?logout_challenge=<opaque-string>
 *
 * WHAT HYDRA EXPECTS FROM US
 *   A call to Hydra's admin "accept logout" endpoint. No body needed
 *   (we pass `{}`) — first-party apps auto-approve. Hydra responds with
 *   the URL to redirect the browser to (usually Auth-Portal's /logout page
 *   which then handles Phase 3 — the Kratos session cleanup).
 *
 * POSSIBLE OUTCOMES
 *   ┌───────────────────────────────────┬─────────────────────────────────┐
 *   │ Condition                         │ What we return                  │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ Logout accepted                   │ 302 Hydra redirect URL          │
 *   │ Hydra admin API fails             │ 302 /error                      │
 *   └───────────────────────────────────┴─────────────────────────────────┘
 */
async function handleScenarioA_LogoutChallenge(
  challenge: string
): Promise<NextResponse> {
  try {
    logInfo("Accepting Hydra logout", { challenge: redactValue(challenge) });

    const accepted = await hydraAdminRequest<{ redirect_to: string }>(
      `/admin/oauth2/auth/requests/logout/accept?logout_challenge=${encodeURIComponent(challenge)}`,
      { method: "PUT", body: JSON.stringify({}) }
    );

    logInfo("Hydra logout accepted", {
      redirectTo: accepted.redirect_to,
      challenge: redactValue(challenge),
    });

    return NextResponse.redirect(accepted.redirect_to);
  } catch (error) {
    logError("Scenario A: logout acceptance failed", {
      error,
      challenge: redactValue(challenge),
    });
    return NextResponse.redirect(`${getAuthPortalPublicUrl()}/error`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO B — Missing logout challenge
// ═══════════════════════════════════════════════════════════════════════════
/*
 * WHO LANDS HERE
 *   Nobody legitimately. Options: a bot poking at the endpoint, a user
 *   refreshing a page whose logout challenge already expired, or a
 *   misconfigured client that stripped the query string.
 *
 * REQUEST SHAPE
 *   GET /oauth/logout            (no logout_challenge parameter)
 *
 * WHAT WE RETURN
 *   400 Bad Request with a minimal JSON error body. No redirect — there's
 *   no flow to continue.
 */
function handleScenarioB_MissingChallenge(): NextResponse {
  logInfo("Scenario B: missing logout challenge — 400");
  return NextResponse.json(
    { error: "missing logout_challenge" },
    { status: 400 }
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
  ctx: { challenge: string | undefined }
) {
  logInfo("REQUEST", {
    method: request.method,
    url: request.url,
    path: request.nextUrl.pathname,
    query: redactQueryParams(request.nextUrl.searchParams),
    userAgent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
    challenge: {
      present: Boolean(ctx.challenge),
      redacted: redactValue(ctx.challenge),
    },
  });
}

/**
 * Log the outgoing response in one consolidated entry. Captures HTTP
 * status, redirect target, and any cookies being set/cleared (the
 * wire-level truth, regardless of where they were applied).
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
 * Copy the request query string for logging, redacting sensitive
 * challenge parameters. Non-challenge keys pass through as-is.
 */
function redactQueryParams(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (
      key === "logout_challenge" ||
      key === "login_challenge" ||
      key === "consent_challenge"
    ) {
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
