import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@bookshare/logger";
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

interface HydraConsentRequest {
  subject: string;
  requested_scope?: string[];
  requested_access_token_audience?: string[];
  context?: {
    traits?: Record<string, unknown>;
  };
}

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("consent_challenge")?.trim();

  if (!challenge) {
    logger.warn("Hydra consent request was missing consent_challenge");
    return NextResponse.json(
      { error: "missing consent_challenge" },
      { status: 400 }
    );
  }

  try {
    return await acceptConsentChallenge(request, challenge);
  } catch (error) {
    logger.error({ err: error }, "Hydra consent challenge failed");
    return NextResponse.redirect(`${getAuthPortalPublicUrl()}/error`);
  }
}

async function acceptConsentChallenge(
  request: NextRequest,
  challenge: string
): Promise<NextResponse> {
  const consentRequest = await hydraAdminRequest<HydraConsentRequest>(
    `/admin/oauth2/auth/requests/consent?consent_challenge=${encodeURIComponent(challenge)}`,
    { method: "GET" }
  );

  const session = await getKratosSession(request.headers.get("cookie") ?? "");
  const traits = normalizeTraits(
    session?.identity?.traits ?? consentRequest.context?.traits ?? {}
  );
  const emailVerified = isKratosEmailVerified(session);
  const subject = session?.identity?.id || consentRequest.subject;
  const email = getTraitEmail(traits);
  const roles = subject
    ? await resolvePlatformRoles({ userId: subject, email, emailVerified })
    : [];

  const idTokenClaims = buildIdTokenClaims(traits, emailVerified, roles);
  const accessTokenClaims = buildAccessTokenClaims(
    subject,
    traits,
    emailVerified,
    roles
  );

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

  logger.info({ subject, roles }, "Hydra consent challenge accepted");
  return NextResponse.redirect(accepted.redirect_to);
}

function normalizeTraits(traits: unknown): Record<string, unknown> {
  return typeof traits === "object" && traits !== null
    ? (traits as Record<string, unknown>)
    : {};
}

function getTraitEmail(traits: Record<string, unknown>): string | null {
  const raw = traits.email;
  if (typeof raw !== "string") return null;

  const normalized = raw.trim().toLowerCase();
  return normalized || null;
}

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
