/**
 * Hydra Consent Challenge Handler — Auth-Portal
 *
 * After the login challenge is accepted (user is authenticated), Hydra creates
 * a consent challenge asking: "What data should be included in the tokens?"
 *
 * For first-party apps, consent is auto-accepted — the user never sees a
 * consent screen. But this handler still does important work:
 *
 * 1. Fetches the latest Kratos session to get current user traits (not stale
 *    data from the login context — the user might have changed their name).
 *
 * 2. Resolves platform roles from two sources:
 *    - BOOTSTRAP_ADMIN_EMAILS env var (for initial admin bootstrapping)
 *    - staff_roles database table (for dynamic role management)
 *
 * 3. Builds the claims that will appear in the ID and access tokens:
 *    - ID token: email, name, email_verified, roles (for client identity)
 *    - Access token: sub, roles, email_verified (for API auth)
 *
 * 4. Accepts the consent with `remember: true` so Hydra caches the decision.
 *
 * The token claims built here are what the client apps extract during their
 * callback phase to build the user session.
 *
 * @see `/oauth/login` — the preceding step
 * @see `staff-roles.ts` — role resolution logic
 * @see `apps/web/src/app/api/auth/callback/route.ts` — where these claims are consumed
 */
import { NextRequest, NextResponse } from "next/server";
import { createLogger, redactValue } from "@bookshare/logger";
import {
  getAuthPortalPublicUrl,
  getHydraRememberFor,
} from "@/shared/lib/config";
import { hydraAdminRequest } from "@/shared/lib/hydra";
import { getKratosSession, isKratosEmailVerified } from "@/shared/lib/kratos";
import { resolvePlatformRoles } from "@/shared/lib/staff-roles";

const logger = createLogger({ service: "auth-web" }).child({
  route: "oauth.consent",
});

interface HydraConsentRequest {
  subject: string;
  requested_scope?: string[];
  requested_access_token_audience?: string[];
  /** Login context passed from the login challenge acceptance. */
  context?: {
    traits?: Record<string, unknown>;
  };
}

/** Extract name claims from Kratos identity traits. */
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

/**
 * Build the claims that Hydra will embed in the ID token.
 * These claims are consumed by the client apps during their callback phase
 * and stored in the encrypted session cookie.
 */
function buildIdTokenClaims(
  traits: Record<string, unknown>,
  emailVerified: boolean,
  roles: string[]
): Record<string, unknown> {
  const email =
    typeof traits.email === "string" ? traits.email.trim().toLowerCase() : "";
  const { firstName, lastName, fullName } = getNameClaims(traits);

  const claims: Record<string, unknown> = {
    email_verified: emailVerified,
  };

  if (email) {
    claims.email = email;
    claims.preferred_username = email.split("@")[0] || email;
  }

  if (firstName) claims.given_name = firstName;
  if (lastName) claims.family_name = lastName;
  if (fullName) claims.name = fullName;
  claims.roles = roles;

  logger.debug(
    {
      emailPresent: Boolean(email),
      hasName: Boolean(fullName),
      roles,
    },
    "Built ID token claims"
  );

  return claims;
}

/**
 * Build the claims that Hydra will embed in the access token.
 * We include email/name traits so resource servers can:
 * - apply bootstrap-admin email rules without an extra userinfo lookup
 * - enrich request.user consistently from either token type
 */
function buildAccessTokenClaims(
  subject: string,
  traits: Record<string, unknown>,
  emailVerified: boolean,
  roles: string[]
): Record<string, unknown> {
  const email =
    typeof traits.email === "string" ? traits.email.trim().toLowerCase() : "";
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

  logger.debug(
    {
      subject,
      emailPresent: Boolean(email),
      hasName: Boolean(fullName),
      roles,
    },
    "Built access token claims"
  );

  return claims;
}

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("consent_challenge");

  if (!challenge) {
    logger.warn("Missing consent challenge");
    return NextResponse.json(
      { error: "missing consent_challenge" },
      { status: 400 }
    );
  }

  try {
    // Fetch the consent challenge details from Hydra — contains the subject,
    // requested scopes, and the login context (traits) from the login step.
    const consentRequest = await hydraAdminRequest<HydraConsentRequest>(
      `/admin/oauth2/auth/requests/consent?consent_challenge=${encodeURIComponent(challenge)}`,
      { method: "GET" }
    );

    // Fetch the LATEST Kratos session — not the cached traits from login context.
    // The user might have updated their profile between login and consent.
    const session = await getKratosSession(request.headers.get("cookie") ?? "");

    // Prefer fresh session traits; fall back to login context traits.
    const traits =
      session?.identity?.traits || consentRequest.context?.traits || {};

    const normalizedTraits =
      typeof traits === "object" && traits !== null
        ? (traits as Record<string, unknown>)
        : {};

    const emailVerified = isKratosEmailVerified(session);
    const subject = session?.identity?.id || consentRequest.subject;
    const email =
      typeof normalizedTraits.email === "string"
        ? normalizedTraits.email.trim().toLowerCase()
        : null;

    // Resolve platform roles from bootstrap config + database.
    // These roles end up in both the ID and access tokens, enabling:
    // - Admin app's callback to gate access
    // - Admin middleware to enforce route protection
    // - Resource server to authorize elevated API operations
    const roles = subject
      ? await resolvePlatformRoles({
          userId: subject,
          email,
          emailVerified,
        })
      : [];

    logger.info(
      {
        subject,
        emailPresent: Boolean(email),
        emailVerified,
        roles,
        requestedScopes: consentRequest.requested_scope ?? [],
        challenge: redactValue(challenge),
      },
      "Accepting Hydra consent request"
    );

    // Accept consent — auto-approved for first-party apps.
    // The `session` field defines what claims appear in each token type.
    const accepted = await hydraAdminRequest<{ redirect_to: string }>(
      `/admin/oauth2/auth/requests/consent/accept?consent_challenge=${encodeURIComponent(challenge)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          // Grant all requested scopes (first-party — no user approval needed).
          grant_scope: consentRequest.requested_scope || [],
          grant_access_token_audience:
            consentRequest.requested_access_token_audience || [],
          remember: true,
          remember_for: getHydraRememberFor(),
          session: {
            // Claims embedded in the ID token (consumed by client apps).
            id_token: buildIdTokenClaims(normalizedTraits, emailVerified, roles),
            // Claims embedded in the access token (consumed by resource server).
            access_token: buildAccessTokenClaims(
              subject,
              normalizedTraits,
              emailVerified,
              roles
            ),
          },
        }),
      }
    );

    const response = NextResponse.redirect(accepted.redirect_to);
    logger.info(
      {
        subject,
        redirectTo: accepted.redirect_to,
        challenge: redactValue(challenge),
      },
      "Hydra consent accepted"
    );
    return response;
  } catch (error) {
    logger.error(
      { err: error, challenge: redactValue(challenge) },
      "OAuth consent challenge handling failed"
    );
    return NextResponse.redirect(`${getAuthPortalPublicUrl()}/error`);
  }
}
