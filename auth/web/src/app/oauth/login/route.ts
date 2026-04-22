/**
 * Hydra Login Challenge Handler — Auth-Portal
 *
 * This is the central decision point of the authentication flow. The browser
 * can arrive here in three distinct ways, and the handler must gracefully
 * support all of them:
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ Arrival pattern           │ Trigger                   │ Challenge source │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ 1. Fresh OAuth request    │ RP (Admin/Web/Bookstores) │ ?login_challenge │
 * │                           │ hit Hydra's /oauth2/auth; │ query param      │
 * │                           │ Hydra redirects here.     │                  │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ 2. Return from Kratos     │ User completed /login,    │ httpOnly cookie  │
 * │                           │ /verification, or         │ (set on the way  │
 * │                           │ /settings and Kratos's    │ out, 15 min TTL) │
 * │                           │ return_to lands here      │                  │
 * │                           │ without the query param.  │                  │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ 3. Standalone visit       │ User typed the portal     │ none             │
 * │                           │ URL, or a post-logout /   │                  │
 * │                           │ "pick an app" resolution  │                  │
 * │                           │ (?source=, ?returnTo=).   │                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Regardless of arrival pattern, a single 3-step authorization policy is
 * applied before the user is considered "ready":
 *
 *   1. Authenticated?  (valid Kratos session)     → else /login
 *   2. Email verified? (verifiable_addresses)     → else /verification
 *   3. Profile complete? (first + last name)      → else /settings?section=profile
 *
 * When a Hydra challenge is present and the policy fails, the challenge is
 * persisted in an httpOnly cookie before redirecting — so that when the user
 * satisfies the failed step and Kratos redirects them back here, we can
 * recover the challenge from the cookie and resume the OAuth flow.
 *
 * When the policy passes:
 *   - With a challenge → accept it via Hydra admin API, binding the OAuth2
 *     tokens to the Kratos identity. `remember=true` lets Hydra skip the
 *     login step on the next request from this browser.
 *   - Without a challenge → resolve which first-party app should own the
 *     session (see `resolveLoginDestination`) and redirect there.
 *
 * OIDC prompt handling (only relevant when a challenge is present):
 *   - `prompt=select_account` → route through the /chooser page.
 *   - `prompt=login`          → force re-authentication via /login.
 *
 * @see `apps/web/src/app/api/auth/login/route.ts` — what triggers Hydra to redirect here
 * @see `/oauth/consent` — the next step after a successful login acceptance
 * @see `hydra-login-context.ts` — challenge cookie persistence
 */
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
import { upsertKnownAccount } from "@/shared/lib/known-accounts-cookie";
import {
  buildLoginDestinationUrl,
  parseLoginResolutionSource,
  resolveLoginDestination,
} from "@/shared/lib/login-destination";

const logger = createLogger({ service: "auth-web" }).child({
  route: "oauth.login",
});

// ─── Types ─────────────────────────────────────────────────────────────────

interface HydraLoginRequest {
  /** True when Hydra has a cached login for this subject (remember=true). */
  skip?: boolean;
  /** The previously authenticated subject ID (only set when skip=true). */
  subject?: string;
  /** OIDC `prompt`, `login_hint`, and similar hints forwarded by the RP. */
  oidc_context?: {
    login_hint?: string;
    ui_locales?: string[];
    acr_values?: string[];
    /** Whitespace-separated OIDC prompt values (e.g. "none", "login", "select_account"). */
    prompt?: string;
  };
  /** The original authorize request URL — inspected when oidc_context is sparse. */
  request_url?: string;
}

/**
 * Outcome of the 3-step authorization policy. Either the user is ready
 * (`ok`) or a specific step failed and the handler must redirect them to
 * the remediation page.
 */
type AuthPolicy =
  | { step: "ok" }
  | { step: "login"; reason: "NO_SESSION" }
  | { step: "verification"; reason: "EMAIL_NOT_VERIFIED" }
  | { step: "profile"; reason: "PROFILE_INCOMPLETE" };

// ─── Logging helpers ───────────────────────────────────────────────────────

function logInfo(event: string, data?: Record<string, unknown>) {
  logger.info(data ?? {}, event);
}

function logError(event: string, data?: Record<string, unknown>) {
  const { error, ...rest } = data ?? {};
  logger.error({ ...rest, err: error }, event);
}

/** Redact a challenge so logs are useful without leaking the full secret. */
function redactChallenge(challenge: string | null | undefined): string | null {
  if (!challenge) return null;
  if (challenge.length <= 10) return "***";
  return `${challenge.slice(0, 6)}...${challenge.slice(-4)}`;
}

// ─── Session trait readers ─────────────────────────────────────────────────

/** Email trait — empty string if absent. */
function getSessionEmail(session: KratosSession | null): string {
  const traits = session?.identity?.traits;
  if (!traits || typeof traits !== "object") return "";
  const raw = (traits as { email?: unknown }).email;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Display name ("First Last") — undefined if absent. */
function getSessionDisplayName(session: KratosSession | null): string | undefined {
  const traits = session?.identity?.traits;
  if (!traits || typeof traits !== "object") return undefined;
  const nameObj = (traits as { name?: unknown }).name;
  if (!nameObj || typeof nameObj !== "object") return undefined;
  const first = (nameObj as { first?: unknown }).first;
  const last = (nameObj as { last?: unknown }).last;
  const parts = [
    typeof first === "string" ? first.trim() : "",
    typeof last === "string" ? last.trim() : "",
  ].filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

// ─── URL builders ──────────────────────────────────────────────────────────

/** Build a URL relative to the Auth-Portal's origin. */
function buildAuthUrl(pathname: string, requestUrl: string): string {
  return new URL(pathname, requestUrl).toString();
}

/** /settings?section=profile — used when profile is incomplete. */
function buildSettingsUrl(requestUrl: string): string {
  const url = new URL(buildAuthUrl("/settings", requestUrl));
  url.searchParams.set("section", "profile");
  return url.toString();
}

/**
 * /login with an optional `email` query param (pre-fills the Kratos
 * identifier input when Hydra forwarded a login_hint from the RP).
 */
function buildLoginUrl(requestUrl: string, loginHint: string): string {
  const url = new URL(buildAuthUrl("/login", requestUrl));
  if (loginHint) url.searchParams.set("email", loginHint);
  return url.toString();
}

// ─── OIDC prompt parsing ───────────────────────────────────────────────────

/**
 * Collect the OIDC `prompt` values from Hydra's login request. Hydra
 * normally surfaces them in `oidc_context.prompt`, but some client libraries
 * pass them only via the original authorize URL — we fall back to parsing
 * `request_url` in that case.
 */
function getPromptValues(loginRequest: HydraLoginRequest): Set<string> {
  const values = new Set<string>();

  const direct = loginRequest.oidc_context?.prompt;
  if (typeof direct === "string" && direct.trim()) {
    for (const value of direct.trim().split(/\s+/)) values.add(value);
  }

  if (!values.size && typeof loginRequest.request_url === "string") {
    try {
      const parsed = new URL(loginRequest.request_url);
      const raw = parsed.searchParams.get("prompt");
      if (raw) {
        for (const value of raw.trim().split(/\s+/)) values.add(value);
      }
    } catch {
      logInfo("Unable to parse request_url for prompt values", {
        requestUrlPresent: Boolean(loginRequest.request_url),
      });
    }
  }

  return values;
}

// ─── Auth policy ───────────────────────────────────────────────────────────

/**
 * Apply the 3-step authorization policy to a Kratos session snapshot.
 * Pure function — no redirects, no side effects. The caller decides what
 * to do with the outcome.
 */
function evaluateAuthPolicy(
  hasSession: boolean,
  emailVerified: boolean,
  profileComplete: boolean
): AuthPolicy {
  if (!hasSession) return { step: "login", reason: "NO_SESSION" };
  if (!emailVerified) return { step: "verification", reason: "EMAIL_NOT_VERIFIED" };
  if (!profileComplete) return { step: "profile", reason: "PROFILE_INCOMPLETE" };
  return { step: "ok" };
}

/**
 * Map a failed policy step to the Auth-Portal page that can fix it.
 * `loginHint` is only relevant for the "login" step.
 */
function buildPolicyRedirectUrl(
  policy: Exclude<AuthPolicy, { step: "ok" }>,
  requestUrl: string,
  loginHint: string
): string {
  switch (policy.step) {
    case "login":
      return buildLoginUrl(requestUrl, loginHint);
    case "verification":
      return buildAuthUrl("/verification", requestUrl);
    case "profile":
      return buildSettingsUrl(requestUrl);
  }
}

// ─── Known-account persistence ─────────────────────────────────────────────

/**
 * Record the just-authenticated identity in the known-accounts cookie so
 * the chooser can offer this account on the next visit. Silent no-op if
 * the session is missing a subject or an email trait.
 */
async function rememberAccountFromSession(
  response: NextResponse,
  session: KratosSession | null
): Promise<void> {
  const sub = session?.identity?.id;
  const email = getSessionEmail(session);
  if (!sub || !email) {
    logInfo("Skipping known-account persistence", {
      hasSubject: Boolean(sub),
      hasEmail: Boolean(email),
    });
    return;
  }

  await upsertKnownAccount(response, {
    sub,
    email,
    name: getSessionDisplayName(session),
  });

  logInfo("Known account persisted", {
    subject: sub,
    email,
    hasDisplayName: Boolean(getSessionDisplayName(session)),
  });
}

// ─── Redirect helpers ──────────────────────────────────────────────────────

/**
 * Redirect while preserving the Hydra login challenge in a cookie.
 * Used when the user hasn't yet satisfied an auth policy step — they'll
 * come back to this handler after completing the step, and the cookie
 * lets us recover the challenge without it being in the query string.
 */
function redirectWithHydraChallenge(
  destination: string,
  challenge: string
): NextResponse {
  logInfo("Redirecting with Hydra challenge persisted", {
    destination,
    challenge: redactChallenge(challenge),
  });
  const response = NextResponse.redirect(destination);
  persistHydraLoginChallenge(response, challenge);
  return response;
}

/**
 * Redirect and clear the challenge cookie — used after successful
 * acceptance or when the challenge is no longer usable.
 */
function redirectAndClearHydraChallenge(destination: string): NextResponse {
  logInfo("Redirecting and clearing Hydra challenge", { destination });
  const response = NextResponse.redirect(destination);
  clearHydraLoginChallenge(response);
  return response;
}

// ─── Hydra admin calls ─────────────────────────────────────────────────────

/**
 * Accept a Hydra login challenge and return the URL the browser should be
 * sent to next (usually Hydra's `/oauth2/auth` continuation).
 *
 * Two modes, selected by `includeTraits`:
 *   - `false` (skip fast-path): Hydra already cached this subject's login
 *     (`remember=true` on a previous acceptance). No need to resend traits.
 *   - `true` (normal path): Fresh login. Attach the user's identity traits
 *     as `context` so the consent handler can use them to build token claims.
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

// ─── Standalone (no-challenge) flow ────────────────────────────────────────

/**
 * Handle an arrival with no Hydra challenge (pattern #3 from the file header).
 *
 * The same 3-step policy applies — but because there's no challenge to
 * preserve, failed steps just redirect without persisting a cookie. When the
 * policy passes, `resolveLoginDestination` decides which first-party app
 * (Admin / Web / Bookstores) the session should be landed on, optionally
 * honoring `?source=` and `?returnTo=` query params.
 */
async function handleStandaloneRequest(
  request: NextRequest,
  session: KratosSession | null,
  policy: AuthPolicy
): Promise<NextResponse> {
  logInfo("Applying standalone auth policy", {
    policy: policy.step,
    path: request.nextUrl.pathname,
    source: request.nextUrl.searchParams.get("source"),
    returnTo: request.nextUrl.searchParams.get("returnTo"),
  });

  if (policy.step !== "ok") {
    const destination = buildPolicyRedirectUrl(policy, request.url, "");
    logInfo("Standalone redirect → policy step", {
      reason: policy.reason,
      step: policy.step,
      destination,
    });
    return NextResponse.redirect(destination);
  }

  // Policy passed ⇒ session is guaranteed to be non-null.
  // Resolve which first-party app owns this session.
  const destination = await resolveLoginDestination(session!);
  const redirectTo = buildLoginDestinationUrl({
    destination,
    source: parseLoginResolutionSource(
      request.nextUrl.searchParams.get("source")
    ),
    requestedReturnTo: request.nextUrl.searchParams.get("returnTo"),
  });

  logInfo("Standalone destination resolved", {
    destination,
    redirectTo,
    subject: session!.identity?.id,
  });

  return NextResponse.redirect(redirectTo);
}

// ─── Challenge-backed flow ─────────────────────────────────────────────────

/**
 * Handle an arrival with a Hydra challenge (patterns #1 and #2). Fetches
 * the challenge metadata from Hydra to inspect `skip` and OIDC `prompt`
 * hints, then applies the same 3-step policy, persisting the challenge in
 * a cookie on any redirect so the flow can resume on return.
 */
async function handleChallengeRequest(
  request: NextRequest,
  session: KratosSession | null,
  policy: AuthPolicy,
  challenge: string
): Promise<NextResponse> {
  logInfo("Fetching Hydra login request", {
    challenge: redactChallenge(challenge),
  });

  const loginRequest = await hydraAdminRequest<HydraLoginRequest>(
    `/admin/oauth2/auth/requests/login?login_challenge=${encodeURIComponent(challenge)}`,
    { method: "GET" }
  );

  const promptValues = getPromptValues(loginRequest);
  const loginHint = loginRequest.oidc_context?.login_hint?.trim() || "";

  logInfo("Hydra login request received", {
    skip: Boolean(loginRequest.skip),
    hydraSubject: loginRequest.subject ?? null,
    loginHintPresent: Boolean(loginHint),
    promptValues: Array.from(promptValues),
    hasRequestUrl: Boolean(loginRequest.request_url),
  });

  // OIDC prompt overrides come first — they explicitly bypass session reuse.

  // `prompt=select_account` asks the user to pick an account even when
  // a valid session exists. Route through the chooser.
  if (promptValues.has("select_account")) {
    const destination = buildAuthUrl("/chooser", request.url);
    logInfo("Prompt → select_account (chooser)", { destination });
    return redirectWithHydraChallenge(destination, challenge);
  }

  // `prompt=login` forces fresh authentication. Route through /login with
  // the hint so the existing session can't auto-accept.
  if (promptValues.has("login")) {
    const destination = buildLoginUrl(request.url, loginHint);
    logInfo("Prompt → login (force re-auth)", {
      destination,
      loginHintPresent: Boolean(loginHint),
    });
    return redirectWithHydraChallenge(destination, challenge);
  }

  // Apply the 3-step policy. Any failure preserves the challenge in a
  // cookie so this handler can resume after the user fixes the step.
  if (policy.step !== "ok") {
    const destination = buildPolicyRedirectUrl(policy, request.url, loginHint);
    logInfo("Policy redirect", {
      reason: policy.reason,
      step: policy.step,
      destination,
      subject: session?.identity?.id,
    });
    return redirectWithHydraChallenge(destination, challenge);
  }

  // Policy passed ⇒ session and identityId are non-null. Accept the challenge.
  const identityId = session!.identity!.id;
  const useSkipFastPath = Boolean(loginRequest.skip && loginRequest.subject);

  logInfo("Accepting Hydra login challenge", {
    mode: useSkipFastPath ? "skip" : "normal",
    subject: identityId,
    rememberedSubject: loginRequest.subject ?? null,
    rememberFor: getHydraRememberFor(),
    hasTraits: Boolean(session!.identity?.traits),
  });

  const redirectTo = await acceptHydraLogin({
    challenge,
    subject: identityId,
    traits: session!.identity?.traits,
    // Skip path doesn't resend traits — Hydra already has them cached.
    includeTraits: !useSkipFastPath,
  });

  logInfo("Hydra login accepted", {
    mode: useSkipFastPath ? "skip" : "normal",
    subject: identityId,
    redirectTo,
  });

  const response = redirectAndClearHydraChallenge(redirectTo);
  await rememberAccountFromSession(response, session);
  return response;
}

// ─── Entry point ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  // Step 1: Recover the challenge.
  //
  // A resolution request (?source= or ?returnTo=) is an explicit "standalone"
  // visit — we must NOT fall back to the cookie, otherwise a stale cookie
  // from a previous OAuth flow could hijack a perfectly valid standalone
  // redirect. Query-param challenges always win; cookies are a convenience
  // for the Kratos-return case only.
  const queryChallenge = request.nextUrl.searchParams.get("login_challenge")?.trim();
  const isResolutionRequest =
    request.nextUrl.searchParams.has("source") ||
    request.nextUrl.searchParams.has("returnTo");
  const challenge =
    queryChallenge ||
    (isResolutionRequest ? null : await getHydraLoginChallenge());

  logInfo("Request received", {
    method: request.method,
    url: request.url,
    path: request.nextUrl.pathname,
    queryChallengePresent: Boolean(queryChallenge),
    resolutionRequest: isResolutionRequest,
    challengeSource: queryChallenge
      ? "query"
      : isResolutionRequest
        ? "none_resolution_request"
        : challenge
          ? "cookie"
          : "none",
    challenge: redactChallenge(challenge),
  });

  // Step 2: Fetch the Kratos session by forwarding the browser's cookies
  // (including ory_kratos_session) to Kratos's /sessions/whoami endpoint.
  const session = await getKratosSession(request.headers.get("cookie") ?? "");
  const identityId = session?.identity?.id;
  const hasSession = Boolean(identityId);
  const emailVerified = isKratosEmailVerified(session);
  const profileComplete = isKratosProfileComplete(session);

  // Step 3: Evaluate the 3-step auth policy once. Both branches consume it.
  const policy = evaluateAuthPolicy(hasSession, emailVerified, profileComplete);

  logInfo("Session and policy resolved", {
    identityId,
    hasSession,
    emailVerified,
    profileComplete,
    hasTraits: Boolean(session?.identity?.traits),
    policy: policy.step,
  });

  // Step 4: Dispatch to the appropriate flow.
  if (!challenge) {
    const response = await handleStandaloneRequest(request, session, policy);
    logInfo("Standalone flow completed", {
      durationMs: Date.now() - startedAt,
      location: response.headers.get("location"),
    });
    return response;
  }

  try {
    const response = await handleChallengeRequest(
      request,
      session,
      policy,
      challenge
    );
    logInfo("Challenge flow completed", {
      durationMs: Date.now() - startedAt,
      location: response.headers.get("location"),
    });
    return response;
  } catch (error) {
    logError("OAuth login challenge handling failed", {
      error,
      challenge: redactChallenge(challenge),
      queryChallengePresent: Boolean(queryChallenge),
      identityId,
      hasSession,
      emailVerified,
      profileComplete,
      durationMs: Date.now() - startedAt,
    });

    // Cookie-sourced challenge: likely stale. Fall back to standalone flow
    // so a past OAuth session doesn't trap the user on an error page.
    if (!queryChallenge) {
      logInfo("Hydra challenge likely stale; falling back to standalone flow");
      const fallback = await handleStandaloneRequest(request, session, policy);
      const destination =
        fallback.headers.get("location") || getBookshareAppPublicUrl();
      logInfo("Fallback destination resolved after Hydra failure", {
        destination,
      });
      return redirectAndClearHydraChallenge(destination);
    }

    // Query-sourced challenge failed: something is actually wrong with
    // Hydra. Send the user to the auth-portal error page.
    const errorDestination = `${getAuthPortalPublicUrl()}/error`;
    logError("Fresh Hydra challenge failed; redirecting to error page", {
      destination: errorDestination,
    });
    return redirectAndClearHydraChallenge(errorDestination);
  }
}
