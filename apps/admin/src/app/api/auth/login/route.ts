import { NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import { encrypt } from "@/features/auth/lib/crypto";
import { getOIDCConfig, getRedirectUri } from "@/features/auth/lib/oidc";
import { sanitizeReturnTo } from "@/features/auth/lib/auth-portal";
import {
  ADMIN_CODE_VERIFIER_COOKIE,
  ADMIN_LOGGED_OUT_COOKIE,
  ADMIN_RETURN_TO_COOKIE,
  ADMIN_STATE_COOKIE,
} from "@/features/auth/lib/cookie-names";

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const redirectUri = getRedirectUri();
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const scope = ["openid", "profile", "email", "offline_access"].join(" ");

  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    prompt: "login",
    max_age: "0",
  });

  const response = NextResponse.redirect(authorizationUrl.href);

  response.cookies.set(ADMIN_CODE_VERIFIER_COOKIE, await encrypt(codeVerifier), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  response.cookies.set(ADMIN_STATE_COOKIE, await encrypt(state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  response.cookies.set(ADMIN_RETURN_TO_COOKIE, await encrypt(returnTo), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  response.cookies.delete(ADMIN_LOGGED_OUT_COOKIE);

  return response;
}
