/**
 * Hydra Login Challenge Handler — Auth-Portal
 *
 * This is the central decision point of the authentication flow. Hydra
 * redirects the browser here when it needs to know WHO is logging in.
 * The challenge parameter is Hydra's way of saying: "I have a client that
 * wants access — tell me which user is behind this request."
 *
 * The handler applies a strict 3-step authorization policy before accepting:
 *
 * 1. **Authenticated?** — Does the browser have a valid Kratos session?
 *    If not → redirect to Auth-Portal's `/login` page (Kratos login flow).
 *
 * 2. **Email verified?** — Does the Kratos identity have a verified email?
 *    If not → redirect to Auth-Portal's `/verification` page.
 *
 * 3. **Profile complete?** — Does the identity have first and last name?
 *    If not → redirect to Auth-Portal's `/settings?section=profile` page.
 *
 * Each redirect persists the Hydra login_challenge as an httpOnly cookie
 * (15 min TTL) so that when the user satisfies the requirement and returns
 * to this handler, the challenge can be recovered without threading it
 * through every Kratos flow's return URL.
 *
 * Once all checks pass, the handler accepts the challenge via Hydra's admin
 * API, passing the Kratos identity ID as the `subject`. This binds the
 * resulting OAuth2 tokens to this specific user.
 *
 * If `loginRequest.skip` is true, Hydra already has a cached login decision
 * for this user (from `remember: true` in a previous acceptance). In that
 * case, the handler fast-tracks acceptance without resending traits.
 *
 * Fallback: if no challenge is available (neither in query params nor cookie),
 * the handler acts as a standalone auth gate — redirecting based on the
 * same 3-step policy, with the final destination being the Web app.
 *
 * @see `apps/web/src/app/api/auth/login/route.ts` — what triggers Hydra to redirect here
 * @see `/oauth/consent` — the next step after login challenge acceptance
 * @see `hydra-login-context.ts` — challenge cookie persistence
 */
import { NextRequest, NextResponse } from "next/server";
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

/** Parse Hydra's OIDC `prompt` values (space-separated) into a set. */
function getPromptValues(loginRequest: HydraLoginRequest): Set<string> {
  const values = new Set<string>();

  const direct = loginRequest.oidc_context?.prompt;
  if (typeof direct === "string" && direct.trim()) {
    for (const value of direct.trim().split(/\s+/)) {
      values.add(value);
    }
  }

  if (!values.size && typeof loginRequest.request_url === "string") {
    try {
      const parsed = new URL(loginRequest.request_url);
      const raw = parsed.searchParams.get("prompt");
      if (raw) {
        for (const value of raw.trim().split(/\s+/)) {
          values.add(value);
        }
      }
    } catch {
      // Ignore — request_url is informational, not all deployments populate it.
    }
  }

  return values;
}

/** Extract the email trait from a Kratos session — empty string if absent. */
function getSessionEmail(session: KratosSession | null): string {
  const traits = session?.identity?.traits;
  if (!traits || typeof traits !== "object") return "";
  const raw = (traits as { email?: unknown }).email;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Extract the display name ("First Last") from a Kratos session — undefined if absent. */
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

/** Build Auth-Portal URL for profile settings (incomplete profile gate). */
function buildSettingsUrl(requestUrl: string): string {
  const settingsUrl = new URL(buildAuthUrl("/settings", requestUrl));
  settingsUrl.searchParams.set("section", "profile");
  return settingsUrl.toString();
}

/** Build a URL relative to the Auth-Portal's origin. */
function buildAuthUrl(pathname: string, requestUrl: string): string {
  return new URL(pathname, requestUrl).toString();
}

/**
 * Build the `/login` URL, prefilling the email field via a `login_hint`
 * query param when Hydra (or a client) provided one. The login page forwards
 * the value to the Kratos identifier input.
 */
function buildLoginUrl(requestUrl: string, loginHint: string): string {
  const loginUrl = new URL(buildAuthUrl("/login", requestUrl));
  if (loginHint) {
    loginUrl.searchParams.set("email", loginHint);
  }
  return loginUrl.toString();
}

/**
 * Persist the just-authenticated identity in the known-accounts cookie so
 * the chooser can offer this account on the next visit. Silent no-op if
 * the session lacks an email trait.
 */
async function rememberAccountFromSession(
  response: NextResponse,
  session: KratosSession | null
): Promise<void> {
  const sub = session?.identity?.id;
  const email = getSessionEmail(session);
  if (!sub || !email) return;

  await upsertKnownAccount(response, {
    sub,
    email,
    name: getSessionDisplayName(session),
  });
}

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
  const response = NextResponse.redirect(destination);
  persistHydraLoginChallenge(response, challenge);
  return response;
}

/**
 * Redirect and clear the challenge cookie — used after successful acceptance
 * or when the challenge is no longer valid (error fallback).
 */
function redirectAndClearHydraChallenge(destination: string): NextResponse {
  const response = NextResponse.redirect(destination);
  clearHydraLoginChallenge(response);
  return response;
}

/**
 * Fallback: no Hydra challenge available (standalone visit or expired cookie).
 * Applies the same 3-step auth policy but redirects to the Web app as the
 * final destination instead of accepting a Hydra challenge.
 */
function redirectWithoutHydraChallenge(
  request: NextRequest,
  hasSession: boolean,
  isEmailVerified: boolean,
  isProfileComplete: boolean
): NextResponse {
  if (!hasSession) {
    return NextResponse.redirect(buildAuthUrl("/login", request.url));
  }

  if (!isEmailVerified) {
    return NextResponse.redirect(buildAuthUrl("/verification", request.url));
  }

  if (!isProfileComplete) {
    return NextResponse.redirect(buildSettingsUrl(request.url));
  }

  // All checks pass — send the fully-authenticated user to the Web app.
  return NextResponse.redirect(getBookshareAppPublicUrl());
}

export async function GET(request: NextRequest) {
  // Recover the challenge: prefer the fresh one from query params (Hydra just
  // redirected here), fall back to the cookie (user completed a Kratos flow
  // and returned).
  const queryChallenge = request.nextUrl.searchParams.get("login_challenge")?.trim();
  const challenge = queryChallenge || (await getHydraLoginChallenge());

  // Check who the user is in Kratos by forwarding the browser's cookies
  // (which include ory_kratos_session) to Kratos's /sessions/whoami endpoint.
  const session = await getKratosSession(request.headers.get("cookie") ?? "");
  const identityId = session?.identity?.id;
  const hasSession = Boolean(identityId);
  const emailVerified = isKratosEmailVerified(session);
  const profileComplete = isKratosProfileComplete(session);

  // No challenge at all — standalone visit. Apply policy without Hydra.
  if (!challenge) {
    return redirectWithoutHydraChallenge(
      request,
      hasSession,
      emailVerified,
      profileComplete
    );
  }

  try {
    // Fetch the login challenge details from Hydra to check if it can be skipped.
    const loginRequest = await hydraAdminRequest<HydraLoginRequest>(
      `/admin/oauth2/auth/requests/login?login_challenge=${encodeURIComponent(challenge)}`,
      { method: "GET" }
    );

    const promptValues = getPromptValues(loginRequest);
    const loginHint = loginRequest.oidc_context?.login_hint?.trim() || "";

    // `prompt=select_account` (or explicit "switch account" links carrying it)
    // asks the user which account to use — even if a valid session exists.
    // Route through the chooser so the user can pick or add an account.
    if (promptValues.has("select_account")) {
      return redirectWithHydraChallenge(
        buildAuthUrl("/chooser", request.url),
        challenge
      );
    }

    // `prompt=login` forces re-authentication even when a valid session exists.
    // Route through /login with the hint (if provided) so the same identity is
    // re-verified rather than letting the existing session auto-accept.
    if (promptValues.has("login")) {
      return redirectWithHydraChallenge(
        buildLoginUrl(request.url, loginHint),
        challenge
      );
    }

    // --- 3-Step Authorization Policy ---
    // Each failed check redirects to the appropriate Auth-Portal page,
    // carrying the challenge in a cookie for when the user comes back.

    // Step 1: Authenticated? If no Kratos session → login page (with hint if available).
    if (!identityId) {
      return redirectWithHydraChallenge(
        buildLoginUrl(request.url, loginHint),
        challenge
      );
    }

    // Step 2: Email verified? If not → verification page.
    if (!emailVerified) {
      return redirectWithHydraChallenge(
        buildAuthUrl("/verification", request.url),
        challenge
      );
    }

    // Step 3: Profile complete? If not → settings page.
    if (!profileComplete) {
      return redirectWithHydraChallenge(buildSettingsUrl(request.url), challenge);
    }

    // --- All checks passed: accept the login challenge ---

    // Fast path: Hydra cached a previous login decision (remember=true).
    // Accept without resending traits — Hydra already has them.
    if (loginRequest.skip && loginRequest.subject) {
      const accepted = await hydraAdminRequest<{ redirect_to: string }>(
        `/admin/oauth2/auth/requests/login/accept?login_challenge=${encodeURIComponent(challenge)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            subject: identityId,
            remember: true,
            remember_for: getHydraRememberFor(),
          }),
        }
      );

      const response = redirectAndClearHydraChallenge(accepted.redirect_to);
      await rememberAccountFromSession(response, session);
      return response;
    }

    // Normal path: fresh login. Send the user's identity traits as context
    // so they're available to the consent handler (for building token claims).
    const accepted = await hydraAdminRequest<{ redirect_to: string }>(
      `/admin/oauth2/auth/requests/login/accept?login_challenge=${encodeURIComponent(challenge)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          subject: identityId,
          remember: true,
          remember_for: getHydraRememberFor(),
          context: {
            traits: session?.identity?.traits || {},
          },
        }),
      }
    );

    const response = redirectAndClearHydraChallenge(accepted.redirect_to);
    await rememberAccountFromSession(response, session);
    return response;
  } catch (error) {
    console.error("OAuth login challenge handling failed", error);

    // If the challenge came from a cookie (not query), it might be stale.
    // Fall back to the no-challenge behavior.
    if (!queryChallenge) {
      const destination = redirectWithoutHydraChallenge(
        request,
        hasSession,
        emailVerified,
        profileComplete
      ).headers.get("location");

      return redirectAndClearHydraChallenge(
        destination || getBookshareAppPublicUrl()
      );
    }

    // Fresh challenge from query failed — something is wrong with Hydra.
    return redirectAndClearHydraChallenge(`${getAuthPortalPublicUrl()}/error`);
  }
}
