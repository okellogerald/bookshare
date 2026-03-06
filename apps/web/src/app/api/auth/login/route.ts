import { NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import { getOIDCConfig, getRedirectUri } from "@/features/auth/lib/oidc";

const FORCE_LOGIN_COOKIE = "bookshare_force_login";

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const redirectUri = getRedirectUri();
  const forceLogin =
    request.cookies.get(FORCE_LOGIN_COOKIE)?.value === "1";

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();

  const baseScopes = ["openid", "profile", "email"];
  const additionalScopes = (
    process.env.ZITADEL_ADDITIONAL_SCOPES ||
    "urn:zitadel:iam:org:project:id:zitadel:aud"
  )
    .split(" ")
    .map((scope) => scope.trim())
    .filter(Boolean);

  const scope = Array.from(new Set([...baseScopes, ...additionalScopes])).join(
    " "
  );

  const parameters: Record<string, string> = {
    redirect_uri: redirectUri,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  };
  if (forceLogin) {
    parameters.prompt = "login";
    parameters.max_age = "0";
  }

  const redirectTo = client.buildAuthorizationUrl(config, parameters);

  // Store code_verifier and state in cookies for the callback
  const response = NextResponse.redirect(redirectTo.href);

  response.cookies.set("oidc_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  response.cookies.set("oidc_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  if (forceLogin) {
    response.cookies.delete(FORCE_LOGIN_COOKIE);
  }

  return response;
}
