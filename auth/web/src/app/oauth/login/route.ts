/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Hydra Login Challenge Handler — Auth-Portal
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  This handler answers ONE question: "should this browser be allowed to
 *  sign in, and if so, as whom?"
 *
 *  Three completely different callers land here. Each has its own scenario
 *  handler below. Read the handlers, not this file, for the full details —
 *  this header is a map.
 *
 *  ┌──────────────┬──────────────────────────────────┬─────────────────────┐
 *  │ Scenario     │ Who calls                         │ How we know         │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ A — FRESH    │ Hydra, because an RP              │ ?login_challenge=X  │
 *  │              │ (Admin/Web/Bookstores) hit its    │ query string        │
 *  │              │ /oauth2/auth endpoint.            │                     │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ B — RESUME   │ The browser, coming back from     │ cookie              │
 *  │              │ a Kratos flow (/login, /verify,   │ bookshare_hydra_    │
 *  │              │ /settings) that we bounced it     │ login_challenge     │
 *  │              │ to earlier in Scenario A.         │                     │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ C — STAND-   │ The user directly, or a browser   │ neither query nor   │
 *  │     ALONE    │ returning after the challenge      │ cookie              │
 *  │              │ cookie expired.                    │                     │
 *  └──────────────┴──────────────────────────────────┴─────────────────────┘
 *
 *  One authorization policy applies to ALL THREE scenarios. It has three
 *  sequential gates, checked in order:
 *
 *       1. Is the browser signed in?           (Kratos session exists)
 *       2. Is the user's email verified?       (Kratos verifiable_addresses)
 *       3. Is the profile complete?            (first + last name)
 *
 *  If a gate fails, we send the user to the matching Auth-Portal page
 *  so they can fix it, then they come back and we try again.
 *
 *  @see `apps/*\/src/app/api/auth/login/route.ts` — what kicks off Scenario A
 *  @see `/oauth/consent` — the step AFTER we accept the login challenge
 *  @see `hydra-login-context.ts` — the cookie used in Scenario B
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@bookshare/logger";
import {
  getAuthPortalPublicUrl,
  getBookshareAppPublicUrl,
  getHydraRememberFor,
} from "@/shared/lib/config";
import {
  clearHydraLoginChallenge,
  getHydraLoginChallenge,
  persistHydraLoginChallenge,
} from "@/shared/lib/hydra-login-context";
import { hydraAdminRequest } from "@/shared/lib/hydra";
import {
  getKratosSession,
  isKratosEmailVerified,
  isKratosProfileComplete,
  type KratosSession,
} from "@/shared/lib/kratos";

const logger = createLogger({ service: "auth-web" }).child({
  route: "oauth.login",
});

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST TRACING
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Every request gets a short `traceId` that is automatically attached to
 * every log line produced while handling it. Grep a single traceId in the
 * logs and you'll see the entire REQUEST → intermediate steps → RESPONSE
 * trace for that one browser hit — even under concurrent load.
 *
 * This works via AsyncLocalStorage: `GET` opens a scope with the traceId,
 * and every `logInfo` / `logError` call (even from nested helpers) reads
 * the current scope and merges the traceId into its log payload.
 */
const requestContext = new AsyncLocalStorage<{ traceId: string }>();

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Shape of Hydra's response when we ask it "tell me about this login
 * challenge". We only use a few fields. See Hydra docs for the rest.
 */
interface HydraLoginRequest {
  /** True when Hydra has a cached login for this subject (remember=true on a previous accept). */
  skip?: boolean;
  /** The previously authenticated subject ID — only meaningful when `skip` is true. */
  subject?: string;
  /** OIDC hints the RP passed to Hydra. */
  oidc_context?: {
    login_hint?: string;
    ui_locales?: string[];
    acr_values?: string[];
    /** Space-separated OIDC prompt values ("none", "login", "select_account", ...). */
    prompt?: string;
  };
  /** The original /oauth2/auth URL. Used as a fallback for prompt parsing. */
  request_url?: string;
}

/**
 * The output of running our 3-step auth policy. Either the user is
 * `ready`, or a specific gate failed and we know which page to send
 * them to.
 */
type AuthPolicy =
  | { ready: true }
  | { ready: false; reason: "NO_SESSION"; sendTo: "login" }
  | { ready: false; reason: "EMAIL_NOT_VERIFIED"; sendTo: "verification" }
  | { ready: false; reason: "PROFILE_INCOMPLETE"; sendTo: "profile" };

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT — classify the request, hand off to the right scenario
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  // Open a traceId scope so every downstream log line (including helpers)
  // carries the same id. `als.run(store, fn)` forwards whatever `fn` returns.
  const traceId = randomUUID().slice(0, 8);
  return requestContext.run({ traceId }, () => handleRequest(request));
}

async function handleRequest(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();

  // --- Gather the inputs we need to decide which scenario this is ---

  const queryChallenge = request.nextUrl.searchParams
    .get("login_challenge")
    ?.trim();

  const cookieChallenge = await getHydraLoginChallenge();

  const session = await getKratosSession(request.headers.get("cookie") ?? "");
  const policy = evaluateAuthPolicy(session);

  // --- REQUEST bookend: everything we know before dispatch ---
  logRequest(request, {
    queryChallenge,
    cookieChallenge,
    session,
    policy,
  });

  // --- Dispatch: exactly one of these three runs ---

  let scenario: "A" | "B" | "C";
  let response: NextResponse;

  if (queryChallenge) {
    scenario = "A";
    response = await handleScenarioA_FreshOAuthRequest(
      request,
      session,
      policy,
      queryChallenge
    );
  } else if (cookieChallenge) {
    scenario = "B";
    response = await handleScenarioB_ResumedOAuthRequest(
      request,
      session,
      policy,
      cookieChallenge
    );
  } else {
    scenario = "C";
    response = await handleScenarioC_StandaloneVisit(request, session, policy);
  }

  // --- RESPONSE bookend: everything about what we're about to return ---
  logResponse(response, { scenario, startedAt });
  return response;
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST / RESPONSE BOOKEND LOGGERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log the incoming request in one consolidated entry. Grep for the `traceId`
 * attached by `requestContext` to find this plus every downstream log line
 * for the same request.
 */
function logRequest(
  request: NextRequest,
  ctx: {
    queryChallenge: string | undefined;
    cookieChallenge: string | null;
    session: KratosSession | null;
    policy: AuthPolicy;
  }
) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  logInfo("REQUEST", {
    method: request.method,
    url: request.url,
    path: request.nextUrl.pathname,
    query: redactQueryParams(request.nextUrl.searchParams),
    cookiesPresent: {
      kratosSession: cookieHeader.includes("ory_kratos_session"),
      hydraChallenge: cookieHeader.includes("bookshare_hydra_login_challenge"),
    },
    userAgent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
    challenge: {
      fromQuery: Boolean(ctx.queryChallenge),
      fromCookie: Boolean(ctx.cookieChallenge),
      redacted: redactChallenge(ctx.queryChallenge ?? ctx.cookieChallenge),
    },
    session: {
      identityId: ctx.session?.identity?.id ?? null,
      emailPresent: Boolean((ctx.session?.identity?.traits as { email?: unknown })?.email),
    },
    policy: {
      ready: ctx.policy.ready,
      reason: ctx.policy.ready ? null : ctx.policy.reason,
    },
  });
}

/**
 * Log the outgoing response in one consolidated entry. Captures the HTTP
 * status, the `Location` redirect target, and every cookie the response
 * is setting or clearing (the wire-level truth, regardless of how the
 * handler got there).
 */
function logResponse(
  response: NextResponse,
  ctx: { scenario: "A" | "B" | "C"; startedAt: number }
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
 * Copy the request query string for logging, replacing any sensitive
 * parameter values (like `login_challenge`) with a redacted version.
 */
function redactQueryParams(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (key === "login_challenge" || key === "logout_challenge" || key === "consent_challenge") {
      out[key] = redactChallenge(value) ?? "";
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO A — Fresh OAuth request from Hydra
// ═══════════════════════════════════════════════════════════════════════════
/*
 * WHO LANDS HERE
 *   Hydra. An RP (Admin / Web / Bookstores) called GET /oauth2/auth on
 *   Hydra. Hydra needed to know who the user is, so it 302'd the browser
 *   here with a brand-new login challenge token.
 *
 * REQUEST SHAPE
 *   GET /oauth/login?login_challenge=<opaque-string>
 *   (browser cookies may include ory_kratos_session if already signed in)
 *
 * WHAT HYDRA EXPECTS FROM US
 *   Either:
 *     (a) Call Hydra's admin "accept login" endpoint with the Kratos user ID
 *         as `subject`. Hydra hands back a URL — we redirect the browser there
 *         and Hydra takes over.
 *     (b) Or, if the user isn't ready (not signed in / unverified / profile
 *         incomplete), send them to the right Kratos page. BEFORE redirecting,
 *         we store the challenge in a cookie so Scenario B can pick it up.
 *
 * POSSIBLE OUTCOMES
 *   ┌───────────────────────────────────┬─────────────────────────────────┐
 *   │ Condition                         │ What we return                  │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ OIDC prompt needs fresh auth      │ 302 /login        (cookie set)  │
 *   │ Policy fails                      │ 302 to gate page  (cookie set)  │
 *   │ Policy passes                     │ 302 Hydra URL     (cookie clear)│
 *   │ Hydra admin API fails             │ 302 /error                      │
 *   └───────────────────────────────────┴─────────────────────────────────┘
 */
async function handleScenarioA_FreshOAuthRequest(
  request: NextRequest,
  session: KratosSession | null,
  policy: AuthPolicy,
  challenge: string
): Promise<NextResponse> {
  try {
    return await processLoginChallenge(request, session, policy, challenge, {
      allowPromptRedirect: true,
    });
  } catch (error) {
    // A fresh challenge that Hydra just minted should not fail. If it did,
    // Hydra is actually broken — send the user to our error page.
    logError("Scenario A: fresh challenge failed", {
      error,
      challenge: redactChallenge(challenge),
    });
    return redirectAndClearHydraChallenge(
      `${getAuthPortalPublicUrl()}/error`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO B — Resumed OAuth request (returning from Kratos)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * WHO LANDS HERE
 *   The browser itself. Earlier, Scenario A decided the user wasn't ready
 *   and 302'd them to Kratos (login / verification / settings), saving the
 *   challenge in a cookie on the way out. Kratos's `return_to` config
 *   bounces them back here once they're done.
 *
 * REQUEST SHAPE
 *   GET /oauth/login                          (no query param)
 *   Cookie: bookshare_hydra_login_challenge=<opaque-string>
 *   Cookie: ory_kratos_session=<session-token>     (now valid)
 *
 * WHAT THE BROWSER EXPECTS FROM US
 *   Exactly what Scenario A would do. The only thing that's different is
 *   where the challenge token came from. So we run the same logic — but
 *   handle failures differently (see below).
 *
 * POSSIBLE OUTCOMES
 *   Same table as Scenario A, except the last row:
 *   ┌───────────────────────────────────┬─────────────────────────────────┐
 *   │ Hydra says challenge is unknown   │ Fall back to Scenario C         │
 *   │ (stale cookie — 15 min expired,   │ (DON'T show an error — the user │
 *   │  or already consumed)             │  likely did nothing wrong)      │
 *   └───────────────────────────────────┴─────────────────────────────────┘
 */
async function handleScenarioB_ResumedOAuthRequest(
  request: NextRequest,
  session: KratosSession | null,
  policy: AuthPolicy,
  challenge: string
): Promise<NextResponse> {
  try {
    return await processLoginChallenge(request, session, policy, challenge, {
      allowPromptRedirect: false,
    });
  } catch (error) {
    // Cookie challenge is probably stale. Don't error out — let the user
    // continue as if they were a standalone visitor.
    logError("Scenario B: cookie challenge stale, falling back to Scenario C", {
      error,
      challenge: redactChallenge(challenge),
    });
    const fallback = await handleScenarioC_StandaloneVisit(
      request,
      session,
      policy
    );
    const destination =
      fallback.headers.get("location") || getBookshareAppPublicUrl();
    return redirectAndClearHydraChallenge(destination);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO C — Standalone visit (no OAuth flow in play)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * WHO LANDS HERE
 *   Two sub-cases, both with no active OAuth flow:
 *     1. A user typed the portal URL / clicked a "manage account" link.
 *     2. A user returning from Kratos AFTER the 15-minute challenge cookie
 *        expired. They'll need to start OAuth again from their RP — but
 *        for now, we just get them somewhere sensible.
 *
 * REQUEST SHAPE
 *   GET /oauth/login                          (direct visit)
 *   No login_challenge query, no challenge cookie.
 *
 * WHAT THEY EXPECT FROM US
 *   Run the same 3-step policy. If they're ready, send them to the
 *   primary BookShare app. Client-specific returnTo handling belongs to
 *   the client-owned OAuth callbacks, not the Auth Portal.
 *
 * POSSIBLE OUTCOMES
 *   ┌──────────────────────────┬──────────────────────────────────────────┐
 *   │ Condition                │ What we return                           │
 *   ├──────────────────────────┼──────────────────────────────────────────┤
 *   │ Policy fails             │ 302 to gate page  (NO cookie — no        │
 *   │                          │ challenge exists to preserve)            │
 *   │ Policy passes            │ 302 to BookShare app URL                 │
 *   └──────────────────────────┴──────────────────────────────────────────┘
 */
async function handleScenarioC_StandaloneVisit(
  request: NextRequest,
  session: KratosSession | null,
  policy: AuthPolicy
): Promise<NextResponse> {
  logInfo("Scenario C: standalone visit", {
    path: request.nextUrl.pathname,
    policyReady: policy.ready,
  });

  if (!policy.ready) {
    const destination = policyFailureUrl(policy, request.url, "");
    logInfo("Scenario C → policy gate", { reason: policy.reason, destination });
    return NextResponse.redirect(destination);
  }

  const redirectTo = getBookshareAppPublicUrl();

  logInfo("Scenario C → default app", {
    redirectTo,
    subject: session?.identity?.id,
  });
  return NextResponse.redirect(redirectTo);
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED: challenge processing used by Scenarios A and B
// ═══════════════════════════════════════════════════════════════════════════
/*
 * The actual "what do we do with a login challenge" logic, used by both
 * scenarios that have one. Throws if Hydra's admin API fails — the
 * caller decides how to handle that.
 *
 * Flow:
 *   1. Ask Hydra to describe this challenge (skip? prompt? login_hint?).
 *   2. On a fresh Hydra redirect, honor OIDC prompts that require re-auth.
 *   3. Run the 3-step auth policy; redirect to gate page on failure.
 *   4. Accept the challenge via Hydra admin API.
 */
async function processLoginChallenge(
  request: NextRequest,
  session: KratosSession | null,
  policy: AuthPolicy,
  challenge: string,
  options: { allowPromptRedirect: boolean }
): Promise<NextResponse> {
  // Step 1: ask Hydra about this challenge.
  const loginRequest = await hydraAdminRequest<HydraLoginRequest>(
    `/admin/oauth2/auth/requests/login?login_challenge=${encodeURIComponent(challenge)}`,
    { method: "GET" }
  );

  const promptValues = getPromptValues(loginRequest);
  const loginHint = loginRequest.oidc_context?.login_hint?.trim() || "";

  logInfo("Hydra login request fetched", {
    skip: Boolean(loginRequest.skip),
    hydraSubject: loginRequest.subject ?? null,
    loginHintPresent: Boolean(loginHint),
    promptValues: Array.from(promptValues),
  });

  // Step 2: OIDC prompt overrides. Only the initial Hydra redirect should
  // create a Kratos login flow. If there is already a Kratos session, make it
  // a refresh flow; otherwise a normal login flow is enough to collect creds.
  if (
    options.allowPromptRedirect &&
    (promptValues.has("login") || promptValues.has("select_account"))
  ) {
    const destination = buildLoginUrl(request.url, loginHint, {
      refresh: Boolean(session?.identity?.id),
    });
    logInfo("OIDC prompt requires fresh login", { destination });
    return redirectWithHydraChallenge(destination, challenge);
  }

  // Step 3: run the auth policy. On failure, save the challenge in a cookie
  // (so Scenario B can resume) and redirect to the matching gate page.
  if (!policy.ready) {
    const destination = policyFailureUrl(policy, request.url, loginHint);
    logInfo("Policy gate failed → redirect", {
      reason: policy.reason,
      destination,
      subject: session?.identity?.id,
    });
    return redirectWithHydraChallenge(destination, challenge);
  }

  // Step 4: user is ready. Accept the challenge.
  // Policy.ready ⇒ session and identityId are non-null.
  const identityId = session!.identity!.id;

  logInfo("Accepting login challenge", {
    subject: identityId,
  });

  const hydraRedirectTo = await acceptHydraLogin({
    challenge,
    subject: identityId,
    traits: session!.identity?.traits,
    includeTraits: true,
  });

  return redirectAndClearHydraChallenge(hydraRedirectTo);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: auth policy (the 3-step gate)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run the three sequential auth checks against a Kratos session.
 * Pure — no network, no redirects. Whoever calls this decides what to do.
 */
function evaluateAuthPolicy(session: KratosSession | null): AuthPolicy {
  if (!session?.identity?.id) {
    return { ready: false, reason: "NO_SESSION", sendTo: "login" };
  }
  if (!isKratosEmailVerified(session)) {
    return { ready: false, reason: "EMAIL_NOT_VERIFIED", sendTo: "verification" };
  }
  if (!isKratosProfileComplete(session)) {
    return { ready: false, reason: "PROFILE_INCOMPLETE", sendTo: "profile" };
  }
  return { ready: true };
}

/**
 * Given a failed policy, return the Auth-Portal URL that can fix it.
 * `loginHint` pre-fills the email input (only relevant for the login step).
 */
function policyFailureUrl(
  policy: Exclude<AuthPolicy, { ready: true }>,
  requestUrl: string,
  loginHint: string
): string {
  switch (policy.sendTo) {
    case "login":
      return buildLoginUrl(requestUrl, loginHint);
    case "verification":
      return buildAuthUrl("/verification", requestUrl);
    case "profile":
      return buildSettingsUrl(requestUrl);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Hydra admin API — accept a login challenge
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tell Hydra "yes, this login challenge is approved, the user is <subject>".
 * Returns the URL Hydra wants us to redirect the browser to next.
 *
 * `remember: true` asks Hydra to cache this decision so future requests
 * from the same browser can use the `skip` fast-path.
 */
async function acceptHydraLogin(params: {
  challenge: string;
  subject: string;
  traits: unknown;
  includeTraits: boolean;
}): Promise<string> {
  const body: Record<string, unknown> = {
    subject: params.subject,
    remember: true,
    remember_for: getHydraRememberFor(),
  };
  if (params.includeTraits) {
    body.context = { traits: params.traits || {} };
  }

  const accepted = await hydraAdminRequest<{ redirect_to: string }>(
    `/admin/oauth2/auth/requests/login/accept?login_challenge=${encodeURIComponent(params.challenge)}`,
    { method: "PUT", body: JSON.stringify(body) }
  );
  return accepted.redirect_to;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: OIDC prompt parsing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Collect all OIDC `prompt` values Hydra knows about. Hydra normally puts
 * them in `oidc_context.prompt`, but some client libs only pass them via
 * the original /oauth2/auth URL — we fall back to parsing `request_url`
 * in that case.
 */
function getPromptValues(loginRequest: HydraLoginRequest): Set<string> {
  const values = new Set<string>();

  const direct = loginRequest.oidc_context?.prompt;
  if (typeof direct === "string" && direct.trim()) {
    for (const v of direct.trim().split(/\s+/)) values.add(v);
  }

  if (!values.size && typeof loginRequest.request_url === "string") {
    try {
      const raw = new URL(loginRequest.request_url).searchParams.get("prompt");
      if (raw) for (const v of raw.trim().split(/\s+/)) values.add(v);
    } catch {
      logInfo("Could not parse request_url for prompt", {});
    }
  }
  return values;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: URL builders
// ═══════════════════════════════════════════════════════════════════════════

/** Any URL relative to the Auth-Portal's origin. */
function buildAuthUrl(pathname: string, requestUrl: string): string {
  return new URL(pathname, requestUrl).toString();
}

/** /settings?section=profile — the page that fixes an incomplete profile. */
function buildSettingsUrl(requestUrl: string): string {
  const url = new URL(buildAuthUrl("/settings", requestUrl));
  url.searchParams.set("section", "profile");
  return url.toString();
}

/**
 * /login, optionally prefilling the email field when Hydra gave us a
 * `login_hint` from the RP.
 */
function buildLoginUrl(
  requestUrl: string,
  loginHint: string,
  options?: { refresh?: boolean }
): string {
  const url = new URL(buildAuthUrl("/login", requestUrl));
  if (loginHint) url.searchParams.set("email", loginHint);
  if (options?.refresh) url.searchParams.set("refresh", "1");
  return url.toString();
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: redirect wrappers that set/clear the challenge cookie
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Redirect AND save the challenge in a cookie. Used whenever we bounce
 * the user to a Kratos page mid-OAuth-flow, so Scenario B can pick up
 * the flow when they come back.
 */
function redirectWithHydraChallenge(
  destination: string,
  challenge: string
): NextResponse {
  logInfo("Redirect (cookie set)", {
    destination,
    challenge: redactChallenge(challenge),
  });
  const response = NextResponse.redirect(destination);
  persistHydraLoginChallenge(response, challenge);
  return response;
}

/** Redirect AND clear the challenge cookie. Used on terminal outcomes. */
function redirectAndClearHydraChallenge(destination: string): NextResponse {
  logInfo("Redirect (cookie cleared)", { destination });
  const response = NextResponse.redirect(destination);
  clearHydraLoginChallenge(response);
  return response;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: logging
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

/** Redact a challenge string for logging (keeps first 6 / last 4 only). */
function redactChallenge(challenge: string | null | undefined): string | null {
  if (!challenge) return null;
  if (challenge.length <= 10) return "***";
  return `${challenge.slice(0, 6)}...${challenge.slice(-4)}`;
}
