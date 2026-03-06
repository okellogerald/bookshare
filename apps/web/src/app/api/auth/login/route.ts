import { NextResponse } from "next/server";
import * as client from "openid-client";
import { getOIDCConfig, getRedirectUri } from "@/features/auth/lib/oidc";

export async function GET() {
  const config = await getOIDCConfig();
  const redirectUri = getRedirectUri();

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

  return response;
}
