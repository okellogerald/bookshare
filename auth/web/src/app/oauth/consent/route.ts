/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Hydra Consent Challenge Handler — Auth-Portal
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  This handler answers ONE question: "what claims should go into the
 *  tokens Hydra is about to mint for this user?"
 *
 *  It runs right after the login challenge was accepted. Because the clients
 *  (Admin / Web / Bookstores) are first-party apps, consent is auto-approved
 *  — the user never sees a consent screen. The real work is building the
 *  ID-token and access-token claims from the freshest identity data.
 *
 *  ┌──────────────┬──────────────────────────────────┬─────────────────────┐
 *  │ Scenario     │ Who calls                         │ How we know         │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ A — CONSENT  │ Hydra, right after the login      │ ?consent_challenge= │
 *  │              │ challenge was accepted.           │ in query string     │
 *  ├──────────────┼──────────────────────────────────┼─────────────────────┤
 *  │ B — INVALID  │ Anyone hitting the endpoint with  │ no challenge in     │
 *  │              │ no challenge (bot, stale link,    │ query string        │
 *  │              │ misconfiguration).                │                     │
 *  └──────────────┴──────────────────────────────────┴─────────────────────┘
 *
 *  The happy path (Scenario A) has five numbered steps inside
 *  `processConsentChallenge` — read those if you want the mechanics.
 *
 *  @see `/oauth/login` — the step that runs first
 *  @see `staff-roles.ts` — how platform roles are resolved
 *  @see `apps/*\/src/app/api/auth/callback/route.ts` — who consumes the claims
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { NextRequest, NextResponse } from "next/server";
import { createLogger, redactValue } from "@bookshare/logger";
import {
  getAuthPortalPublicUrl,
  getHydraRememberFor,
} from "@/shared/lib/config";
import { hydraAdminRequest } from "@/shared/lib/hydra";
import {
  getKratosSession,
  isKratosEmailVerified,
} from "@/shared/lib/kratos";
import { resolvePlatformRoles } from "@/shared/lib/staff-roles";

const logger = createLogger({ service: "auth-web" }).child({
  route: "oauth.consent",
});

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Shape of Hydra's response when we ask it "describe this consent challenge".
 * We only use a handful of fields. See Hydra docs for the rest.
 */
interface HydraConsentRequest {
  subject: string;
  requested_scope?: string[];
  requested_access_token_audience?: string[];
  /** Login context passed through from the login challenge acceptance. */
  context?: {
    traits?: Record<string, unknown>;
  };
}

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
    .get("consent_challenge")
    ?.trim();

  // --- REQUEST bookend ---
  logRequest(request, { challenge });

  // --- Dispatch: exactly one of these two runs ---
  let scenario: "A" | "B";
  let response: NextResponse;

  if (challenge) {
    scenario = "A";
    response = await handleScenarioA_ConsentChallenge(request, challenge);
  } else {
    scenario = "B";
    response = handleScenarioB_MissingChallenge();
  }

  // --- RESPONSE bookend ---
  logResponse(response, { scenario, startedAt });
  return response;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO A — Hydra consent exchange (the only real flow)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * WHO LANDS HERE
 *   Hydra. The browser just finished the login step; Hydra generated a
 *   consent challenge and 302'd here so we can tell it what claims to
 *   embed in the tokens it's about to mint.
 *
 * REQUEST SHAPE
 *   GET /oauth/consent?consent_challenge=<opaque-string>
 *   (browser cookies may include ory_kratos_session — we re-fetch it
 *    here to pick up any profile edits made since login)
 *
 * WHAT HYDRA EXPECTS FROM US
 *   A call to Hydra's admin "accept consent" endpoint with:
 *     - grant_scope (we grant everything; these are first-party clients)
 *     - grant_access_token_audience
 *     - session.id_token     — claims embedded in the ID token
 *     - session.access_token — claims embedded in the access token
 *   Hydra responds with a redirect URL; we forward the browser there.
 *
 * POSSIBLE OUTCOMES
 *   ┌───────────────────────────────────┬─────────────────────────────────┐
 *   │ Condition                         │ What we return                  │
 *   ├───────────────────────────────────┼─────────────────────────────────┤
 *   │ Consent accepted                  │ 302 Hydra redirect URL          │
 *   │ Hydra admin API fails             │ 302 /error                      │
 *   └───────────────────────────────────┴─────────────────────────────────┘
 */
async function handleScenarioA_ConsentChallenge(
  request: NextRequest,
  challenge: string
): Promise<NextResponse> {
  try {
    return await processConsentChallenge(request, challenge);
  } catch (error) {
    logError("Scenario A: consent processing failed", {
      error,
      challenge: redactValue(challenge),
    });
    return NextResponse.redirect(`${getAuthPortalPublicUrl()}/error`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO B — Missing consent challenge
// ═══════════════════════════════════════════════════════════════════════════
/*
 * WHO LANDS HERE
 *   Nobody legitimately. Options: a bot poking at the endpoint, a user
 *   refreshing a page whose consent challenge already expired, or a
 *   misconfigured client that stripped the query string.
 *
 * REQUEST SHAPE
 *   GET /oauth/consent            (no consent_challenge parameter)
 *
 * WHAT WE RETURN
 *   400 Bad Request with a minimal JSON error body. We don't redirect
 *   anywhere because there's no flow to continue.
 */
function handleScenarioB_MissingChallenge(): NextResponse {
  logInfo("Scenario B: missing consent challenge — 400");
  return NextResponse.json(
    { error: "missing consent_challenge" },
    { status: 400 }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED: the actual consent-acceptance dance used by Scenario A
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Five numbered steps:
 *   1. Fetch the challenge metadata from Hydra (subject, scopes, context).
 *   2. Fetch the freshest Kratos session — the user might have edited
 *      their profile between the login and consent steps.
 *   3. Resolve platform roles (bootstrap env + staff_roles table).
 *   4. Build ID-token and access-token claims from the resolved identity.
 *   5. Accept the consent via Hydra's admin API and return its redirect.
 *
 * Throws if any Hydra admin call fails — Scenario A's wrapper converts
 * that into a redirect to /error.
 */
async function processConsentChallenge(
  request: NextRequest,
  challenge: string
): Promise<NextResponse> {
  // Step 1: ask Hydra about this consent challenge.
  const consentRequest = await hydraAdminRequest<HydraConsentRequest>(
    `/admin/oauth2/auth/requests/consent?consent_challenge=${encodeURIComponent(challenge)}`,
    { method: "GET" }
  );

  logInfo("Hydra consent request fetched", {
    subject: consentRequest.subject,
    requestedScopes: consentRequest.requested_scope ?? [],
    audienceCount: consentRequest.requested_access_token_audience?.length ?? 0,
    hasContextTraits: Boolean(consentRequest.context?.traits),
  });

  // Step 2: pull the freshest identity data we can.
  //   - Prefer Kratos session traits (current state).
  //   - Fall back to the traits carried through from the login context.
  //   - Fall back to {} as a last resort.
  const session = await getKratosSession(request.headers.get("cookie") ?? "");
  const traits = normalizeTraits(
    session?.identity?.traits ?? consentRequest.context?.traits ?? {}
  );
  const emailVerified = isKratosEmailVerified(session);
  const subject = session?.identity?.id || consentRequest.subject;
  const email = getTraitEmail(traits);

  logInfo("Identity resolved for consent", {
    subject,
    sourceOfTraits: session?.identity?.traits
      ? "kratos_session"
      : consentRequest.context?.traits
        ? "login_context"
        : "empty",
    emailPresent: Boolean(email),
    emailVerified,
  });

  // Step 3: resolve platform roles — drives admin gating and API authorization.
  const roles = subject
    ? await resolvePlatformRoles({ userId: subject, email, emailVerified })
    : [];

  logInfo("Platform roles resolved", {
    subject,
    roles,
    sourceCount: roles.length,
  });

  // Step 4: build the two token claim sets.
  const idTokenClaims = buildIdTokenClaims(traits, emailVerified, roles);
  const accessTokenClaims = buildAccessTokenClaims(
    subject,
    traits,
    emailVerified,
    roles
  );

  // Step 5: accept the consent. `remember: true` lets Hydra skip this
  // dance for the same subject + client combination on subsequent logins.
  logInfo("Accepting Hydra consent", {
    subject,
    rememberFor: getHydraRememberFor(),
    idTokenClaimKeys: Object.keys(idTokenClaims),
    accessTokenClaimKeys: Object.keys(accessTokenClaims),
    challenge: redactValue(challenge),
  });

  const accepted = await hydraAdminRequest<{ redirect_to: string }>(
    `/admin/oauth2/auth/requests/consent/accept?consent_challenge=${encodeURIComponent(challenge)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        grant_scope: consentRequest.requested_scope || [],
        grant_access_token_audience:
          consentRequest.requested_access_token_audience || [],
        remember: true,
        remember_for: getHydraRememberFor(),
        session: {
          id_token: idTokenClaims,
          access_token: accessTokenClaims,
        },
      }),
    }
  );

  logInfo("Hydra consent accepted", {
    subject,
    redirectTo: accepted.redirect_to,
  });

  return NextResponse.redirect(accepted.redirect_to);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: trait readers
// ═══════════════════════════════════════════════════════════════════════════

/** Guard: treat non-object traits as empty. */
function normalizeTraits(traits: unknown): Record<string, unknown> {
  return typeof traits === "object" && traits !== null
    ? (traits as Record<string, unknown>)
    : {};
}

/** Lowercased, trimmed email — null if absent. */
function getTraitEmail(traits: Record<string, unknown>): string | null {
  const raw = traits.email;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  return normalized || null;
}

/**
 * Extract `given_name` / `family_name` / full-name components from the
 * Kratos `traits.name` object. Missing parts come back as empty strings.
 */
function getNameClaims(traits: Record<string, unknown>) {
  const nameObj =
    typeof traits.name === "object" && traits.name !== null
      ? (traits.name as Record<string, unknown>)
      : {};

  const firstName =
    typeof nameObj.first === "string" ? nameObj.first.trim() : "";
  const lastName =
    typeof nameObj.last === "string" ? nameObj.last.trim() : "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return { firstName, lastName, fullName };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: token claim builders
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ID-token claims — consumed by the client apps during their /callback
 * phase and stored in the encrypted session cookie.
 */
function buildIdTokenClaims(
  traits: Record<string, unknown>,
  emailVerified: boolean,
  roles: string[]
): Record<string, unknown> {
  const email = getTraitEmail(traits);
  const { firstName, lastName, fullName } = getNameClaims(traits);

  const claims: Record<string, unknown> = {
    email_verified: emailVerified,
    roles,
  };

  if (email) {
    claims.email = email;
    claims.preferred_username = email.split("@")[0] || email;
  }
  if (firstName) claims.given_name = firstName;
  if (lastName) claims.family_name = lastName;
  if (fullName) claims.name = fullName;

  return claims;
}

/**
 * Access-token claims — consumed by the API resource server so it can
 * apply bootstrap-admin rules and build `request.user` without an extra
 * userinfo lookup.
 */
function buildAccessTokenClaims(
  subject: string,
  traits: Record<string, unknown>,
  emailVerified: boolean,
  roles: string[]
): Record<string, unknown> {
  const email = getTraitEmail(traits);
  const { firstName, lastName, fullName } = getNameClaims(traits);

  const claims: Record<string, unknown> = {
    sub: subject,
    email_verified: emailVerified,
    roles,
  };

  if (email) {
    claims.email = email;
    claims.preferred_username = email.split("@")[0] || email;
  }
  if (firstName) claims.given_name = firstName;
  if (lastName) claims.family_name = lastName;
  if (fullName) claims.name = fullName;

  return claims;
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
  const cookieHeader = request.headers.get("cookie") ?? "";
  logInfo("REQUEST", {
    method: request.method,
    url: request.url,
    path: request.nextUrl.pathname,
    query: redactQueryParams(request.nextUrl.searchParams),
    cookiesPresent: {
      kratosSession: cookieHeader.includes("ory_kratos_session"),
    },
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
      key === "consent_challenge" ||
      key === "login_challenge" ||
      key === "logout_challenge"
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
