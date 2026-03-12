import { NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import { getOIDCConfig, getRedirectUri } from "@/features/auth/lib/oidc";
import { encrypt } from "@/features/auth/lib/crypto";

function sanitizeReturnTo(value: string | null): string {
  if (!value) return "/browse";
  if (!value.startsWith("/")) return "/browse";
  if (value.startsWith("//")) return "/browse";
  if (value.startsWith("/api/auth")) return "/browse";
  return value;
}

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const redirectUri = getRedirectUri();
  const returnTo = sanitizeReturnTo(
    request.nextUrl.searchParams.get("returnTo")
  );

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();

  const baseScopes = ["openid", "profile", "email"];
  const additionalScopes = (process.env.OIDC_ADDITIONAL_SCOPES || "offline_access")
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
    prompt: "login",
    max_age: "0",
  };

  const redirectTo = client.buildAuthorizationUrl(config, parameters);

  const response = NextResponse.redirect(redirectTo.href);

  response.cookies.set("oidc_code_verifier", await encrypt(codeVerifier), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  response.cookies.set("oidc_state", await encrypt(state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  response.cookies.set("oidc_return_to", await encrypt(returnTo), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  response.cookies.delete("bookshare_logged_out");

  return response;
}
