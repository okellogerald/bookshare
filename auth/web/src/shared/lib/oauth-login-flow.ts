import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@bookshare/logger";
import { getHydraRememberFor } from "@/shared/lib/config";
import {
  clearHydraLoginChallenge,
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
  route: "oauth.login-flow",
});

interface HydraLoginRequest {
  /** True when Hydra says this browser can reuse a remembered login decision. */
  skip?: boolean;
  /** The remembered subject for `skip` flows; useful for diagnostics/future fast paths. */
  subject?: string;
  oidc_context?: {
    /** Client-provided email/username hint. We use it to prefill the login form. */
    login_hint?: string;
    /** Space-separated OIDC prompts, e.g. "login" or "select_account". */
    prompt?: string;
  };
  /** Original `/oauth2/auth` URL; Hydra may preserve prompt values only here. */
  request_url?: string;
}

type AuthPolicy =
  | { ready: true }
  | { ready: false; reason: "NO_SESSION"; sendTo: "login" }
  | { ready: false; reason: "EMAIL_NOT_VERIFIED"; sendTo: "verification" }
  | { ready: false; reason: "PROFILE_INCOMPLETE"; sendTo: "profile" };

/**
 * Handles a fresh Hydra redirect from `/oauth/login`.
 * OIDC prompts are honored here because this is the only entry point Hydra
 * calls directly for a new authorization request.
 */
export async function answerHydraLoginChallenge(
  request: NextRequest,
  challenge: string
): Promise<NextResponse> {
  const loginRequest = await getHydraLoginRequest(challenge);
  const session = await getKratosSession(request.headers.get("cookie") ?? "");
  const loginHint = loginRequest.oidc_context?.login_hint?.trim() || "";
  const prompts = getOidcPromptValues(loginRequest);

  if (prompts.has("login")) {
    logger.info("Hydra login challenge requires fresh Kratos login");
    return redirectWithChallenge(
      buildLoginUrl(request.url, loginHint, {
        refresh: Boolean(session?.identity?.id),
      }),
      challenge
    );
  }

  return completeHydraLoginChallenge(request, challenge, session, loginHint);
}

/**
 * Continues a pending challenge after the user returns from Kratos pages.
 * Prompt handling is intentionally skipped here to avoid looping after the
 * user has already satisfied the fresh-login requirement.
 */
export async function resumeHydraLoginChallenge(
  request: NextRequest,
  challenge: string
): Promise<NextResponse> {
  const loginRequest = await getHydraLoginRequest(challenge);
  const session = await getKratosSession(request.headers.get("cookie") ?? "");
  const loginHint = loginRequest.oidc_context?.login_hint?.trim() || "";

  return completeHydraLoginChallenge(request, challenge, session, loginHint);
}

/** Applies auth policy and accepts the Hydra challenge once the user is ready. */
async function completeHydraLoginChallenge(
  request: NextRequest,
  challenge: string,
  session: KratosSession | null,
  loginHint: string
): Promise<NextResponse> {
  const policy = evaluateAuthPolicy(session);
  if (!policy.ready) {
    logger.info(
      { reason: policy.reason, subject: session?.identity?.id ?? null },
      "Hydra login challenge paused for identity gate"
    );
    return redirectWithChallenge(
      policyFailureUrl(policy, request.url, loginHint),
      challenge
    );
  }

  const identity = session?.identity;
  if (!identity?.id) {
    throw new Error("Hydra login policy passed without a Kratos identity");
  }

  const subject = identity.id;
  const accepted = await hydraAdminRequest<{ redirect_to: string }>(
    `/admin/oauth2/auth/requests/login/accept?login_challenge=${encodeURIComponent(challenge)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        subject,
        remember: true,
        remember_for: getHydraRememberFor(),
        context: { traits: identity.traits || {} },
      }),
    }
  );

  logger.info({ subject }, "Hydra login challenge accepted");
  return redirectClearingChallenge(accepted.redirect_to);
}

/** Fetches Hydra's metadata for the opaque login challenge ID. */
function getHydraLoginRequest(challenge: string): Promise<HydraLoginRequest> {
  return hydraAdminRequest<HydraLoginRequest>(
    `/admin/oauth2/auth/requests/login?login_challenge=${encodeURIComponent(challenge)}`,
    { method: "GET" }
  );
}

/** Pure policy check for the identity gates required before Hydra can continue. */
function evaluateAuthPolicy(session: KratosSession | null): AuthPolicy {
  if (!session?.identity?.id) {
    return { ready: false, reason: "NO_SESSION", sendTo: "login" };
  }
  if (!isKratosEmailVerified(session)) {
    return {
      ready: false,
      reason: "EMAIL_NOT_VERIFIED",
      sendTo: "verification",
    };
  }
  if (!isKratosProfileComplete(session)) {
    return { ready: false, reason: "PROFILE_INCOMPLETE", sendTo: "profile" };
  }
  return { ready: true };
}

/** Maps a failed identity gate to the Auth Portal page that can fix it. */
function policyFailureUrl(
  policy: Exclude<AuthPolicy, { ready: true }>,
  requestUrl: string,
  loginHint: string
): string {
  switch (policy.sendTo) {
    case "login":
      return buildLoginUrl(requestUrl, loginHint);
    case "verification":
      return buildVerificationUrl(requestUrl);
    case "profile":
      return buildProfileSettingsUrl(requestUrl);
  }
}

/** Reads OIDC prompt values from Hydra, including the original request URL fallback. */
function getOidcPromptValues(loginRequest: HydraLoginRequest): Set<string> {
  const prompts = new Set<string>();
  const direct = loginRequest.oidc_context?.prompt;

  if (typeof direct === "string" && direct.trim()) {
    for (const value of direct.trim().split(/\s+/)) {
      prompts.add(value);
    }
  }

  if (!prompts.size && typeof loginRequest.request_url === "string") {
    try {
      const rawPrompt = new URL(loginRequest.request_url).searchParams.get(
        "prompt"
      );
      if (rawPrompt) {
        for (const value of rawPrompt.trim().split(/\s+/)) {
          prompts.add(value);
        }
      }
    } catch {
      logger.warn("Could not parse Hydra login request_url prompt");
    }
  }

  return prompts;
}

function buildAuthUrl(pathname: string, requestUrl: string): string {
  return new URL(pathname, requestUrl).toString();
}

function buildOAuthResumeUrl(requestUrl: string): string {
  return buildAuthUrl("/oauth/resume", requestUrl);
}

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

function buildVerificationUrl(requestUrl: string): string {
  const url = new URL(buildAuthUrl("/verification", requestUrl));
  url.searchParams.set("return_to", buildOAuthResumeUrl(requestUrl));
  return url.toString();
}

function buildProfileSettingsUrl(requestUrl: string): string {
  const url = new URL(buildAuthUrl("/settings", requestUrl));
  url.searchParams.set("section", "profile");
  return url.toString();
}

function redirectWithChallenge(
  destination: string,
  challenge: string
): NextResponse {
  const response = NextResponse.redirect(destination);
  persistHydraLoginChallenge(response, challenge);
  return response;
}

function redirectClearingChallenge(destination: string): NextResponse {
  const response = NextResponse.redirect(destination);
  clearHydraLoginChallenge(response);
  return response;
}
