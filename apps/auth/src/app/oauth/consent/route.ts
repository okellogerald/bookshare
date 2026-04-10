import { NextRequest, NextResponse } from "next/server";
import {
  getAuthPortalPublicUrl,
  getHydraRememberFor,
} from "@/lib/config";
import { hydraAdminRequest } from "@/lib/hydra";
import { getKratosSession, isKratosEmailVerified } from "@/lib/kratos";
import { resolveStaffRoles } from "@/lib/staff-roles";

interface HydraConsentRequest {
  subject: string;
  requested_scope?: string[];
  requested_access_token_audience?: string[];
  context?: {
    traits?: Record<string, unknown>;
  };
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
  if (roles.length > 0) {
    claims.roles = roles;
    claims.realm_access = { roles };
  }

  return claims;
}

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("consent_challenge");

  if (!challenge) {
    return NextResponse.json(
      { error: "missing consent_challenge" },
      { status: 400 }
    );
  }

  try {
    const consentRequest = await hydraAdminRequest<HydraConsentRequest>(
      `/admin/oauth2/auth/requests/consent?consent_challenge=${encodeURIComponent(challenge)}`,
      { method: "GET" }
    );

    const session = await getKratosSession(request.headers.get("cookie") ?? "");

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
    const roles = subject
      ? await resolveStaffRoles({
          userId: subject,
          email,
        })
      : [];

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
            id_token: buildIdTokenClaims(normalizedTraits, emailVerified, roles),
            access_token: {
              sub: subject,
              roles,
              realm_access: {
                roles,
              },
              email_verified: emailVerified,
            },
          },
        }),
      }
    );

    return NextResponse.redirect(accepted.redirect_to);
  } catch (error) {
    console.error("OAuth consent challenge handling failed", error);
    return NextResponse.redirect(`${getAuthPortalPublicUrl()}/error`);
  }
}
