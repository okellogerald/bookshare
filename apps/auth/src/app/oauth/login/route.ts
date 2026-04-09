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

function buildSettingsUrl(requestUrl: string): string {
  const settingsUrl = new URL(buildAuthUrl("/settings", requestUrl));
  settingsUrl.searchParams.set("section", "profile");
  return settingsUrl.toString();
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

function redirectWithoutHydraChallenge(
  request: NextRequest,
  hasSession: boolean,
  isEmailVerified: boolean,
  isProfileComplete: boolean
): NextResponse {
  // This is the auth-box fallback used after standalone login completions and
  // when a previously stored Hydra challenge is no longer valid. The route
  // still applies the same auth policy ordering:
  // 1. authenticate
  // 2. verify email
  // 3. complete profile
  // 4. enter the web app
  if (!hasSession) {
    return NextResponse.redirect(buildAuthUrl("/login", request.url));
  }

  if (!isEmailVerified) {
    return NextResponse.redirect(buildAuthUrl("/verification", request.url));
  }

  if (!isProfileComplete) {
    return NextResponse.redirect(buildSettingsUrl(request.url));
  }

  return NextResponse.redirect(getBookshareAppPublicUrl());
}

export async function GET(request: NextRequest) {
  const queryChallenge = request.nextUrl.searchParams.get("login_challenge")?.trim();
  const challenge = queryChallenge || (await getHydraLoginChallenge());
  const session = await getKratosSession(request.headers.get("cookie") ?? "");
  const identityId = session?.identity?.id;
  const hasSession = Boolean(identityId);
  const emailVerified = isKratosEmailVerified(session);
  const profileComplete = isKratosProfileComplete(session);

  if (!challenge) {
    return redirectWithoutHydraChallenge(
      request,
      hasSession,
      emailVerified,
      profileComplete
    );
  }

  try {
    const loginRequest = await hydraAdminRequest<HydraLoginRequest>(
      `/admin/oauth2/auth/requests/login?login_challenge=${encodeURIComponent(challenge)}`,
      { method: "GET" }
    );

    if (!identityId) {
      return redirectWithHydraChallenge(
        buildAuthUrl("/login", request.url),
        challenge
      );
    }

    if (!emailVerified) {
      return redirectWithHydraChallenge(
        buildAuthUrl("/verification", request.url),
        challenge
      );
    }

    if (!profileComplete) {
      return redirectWithHydraChallenge(buildSettingsUrl(request.url), challenge);
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

    return redirectAndClearHydraChallenge(`${getAuthPortalPublicUrl()}/error`);
  }
}
