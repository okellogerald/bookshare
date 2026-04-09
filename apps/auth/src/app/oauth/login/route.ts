import { NextRequest, NextResponse } from "next/server";
import {
  getAuthPortalPublicUrl,
  getBookshareAppPublicUrl,
  getHydraRememberFor,
} from "@/lib/config";
import {
  clearHydraLoginChallenge,
  getHydraLoginChallenge,
  persistHydraLoginChallenge,
} from "@/lib/hydra-login-context";
import { hydraAdminRequest } from "@/lib/hydra";
import {
  getKratosSession,
  isKratosEmailVerified,
  isKratosProfileComplete,
} from "@/lib/kratos";

interface HydraLoginRequest {
  skip?: boolean;
  subject?: string;
}

function buildAuthUrl(pathname: string, requestUrl: string): string {
  return new URL(pathname, requestUrl).toString();
}

function redirectWithHydraChallenge(
  destination: string,
  challenge: string
): NextResponse {
  const response = NextResponse.redirect(destination);
  persistHydraLoginChallenge(response, challenge);
  return response;
}

function redirectAndClearHydraChallenge(destination: string): NextResponse {
  const response = NextResponse.redirect(destination);
  clearHydraLoginChallenge(response);
  return response;
}

export async function GET(request: NextRequest) {
  const queryChallenge = request.nextUrl.searchParams.get("login_challenge")?.trim();
  const challenge = queryChallenge || (await getHydraLoginChallenge());

  if (!challenge) {
    const session = await getKratosSession(request.headers.get("cookie") ?? "");
    if (session?.identity?.id) {
      return NextResponse.redirect(getBookshareAppPublicUrl());
    }

    return NextResponse.redirect(buildAuthUrl("/login", request.url));
  }

  try {
    const loginRequest = await hydraAdminRequest<HydraLoginRequest>(
      `/admin/oauth2/auth/requests/login?login_challenge=${encodeURIComponent(challenge)}`,
      { method: "GET" }
    );

    const session = await getKratosSession(request.headers.get("cookie") ?? "");
    const identityId = session?.identity?.id;

    if (!identityId) {
      return redirectWithHydraChallenge(
        buildAuthUrl("/login", request.url),
        challenge
      );
    }

    if (!isKratosEmailVerified(session)) {
      return redirectWithHydraChallenge(
        buildAuthUrl("/verification", request.url),
        challenge
      );
    }

    if (!isKratosProfileComplete(session)) {
      const settingsUrl = new URL(buildAuthUrl("/settings", request.url));
      settingsUrl.searchParams.set("section", "profile");

      return redirectWithHydraChallenge(settingsUrl.toString(), challenge);
    }

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

      return redirectAndClearHydraChallenge(accepted.redirect_to);
    }

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

    return redirectAndClearHydraChallenge(accepted.redirect_to);
  } catch (error) {
    console.error("OAuth login challenge handling failed", error);
    if (!queryChallenge) {
      return redirectAndClearHydraChallenge(getBookshareAppPublicUrl());
    }

    return redirectAndClearHydraChallenge(`${getAuthPortalPublicUrl()}/error`);
  }
}
