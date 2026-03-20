import { NextRequest, NextResponse } from "next/server";
import {
  getAuthPortalPublicUrl,
  getHydraRememberFor,
} from "@/lib/config";
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

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("login_challenge");

  if (!challenge) {
    return NextResponse.json(
      { error: "missing login_challenge" },
      { status: 400 }
    );
  }

  try {
    const loginRequest = await hydraAdminRequest<HydraLoginRequest>(
      `/admin/oauth2/auth/requests/login?login_challenge=${encodeURIComponent(challenge)}`,
      { method: "GET" }
    );

    const session = await getKratosSession(request.headers.get("cookie") ?? "");
    const identityId = session?.identity?.id;

    if (!identityId) {
      const returnTo = new URL(`${getAuthPortalPublicUrl()}/oauth/login`);
      returnTo.searchParams.set("login_challenge", challenge);

      const loginUrl = new URL(`${getAuthPortalPublicUrl()}/login`);
      loginUrl.searchParams.set("return_to", returnTo.toString());

      return NextResponse.redirect(loginUrl.toString());
    }

    if (!isKratosEmailVerified(session)) {
      const returnTo = new URL(`${getAuthPortalPublicUrl()}/oauth/login`);
      returnTo.searchParams.set("login_challenge", challenge);

      const verificationUrl = new URL(`${getAuthPortalPublicUrl()}/verification`);
      verificationUrl.searchParams.set("return_to", returnTo.toString());

      return NextResponse.redirect(verificationUrl.toString());
    }

    if (!isKratosProfileComplete(session)) {
      const returnTo = new URL(`${getAuthPortalPublicUrl()}/oauth/login`);
      returnTo.searchParams.set("login_challenge", challenge);

      const settingsUrl = new URL(`${getAuthPortalPublicUrl()}/settings`);
      settingsUrl.searchParams.set("section", "profile");
      settingsUrl.searchParams.set("return_to", returnTo.toString());

      return NextResponse.redirect(settingsUrl.toString());
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

      return NextResponse.redirect(accepted.redirect_to);
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

    return NextResponse.redirect(accepted.redirect_to);
  } catch (error) {
    console.error("OAuth login challenge handling failed", error);
    return NextResponse.redirect(`${getAuthPortalPublicUrl()}/error`);
  }
}
