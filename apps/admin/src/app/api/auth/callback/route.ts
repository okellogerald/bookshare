import { NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import { decrypt } from "@/features/auth/lib/crypto";
import { getOIDCConfig } from "@/features/auth/lib/oidc";
import { setSession } from "@/features/auth/lib/session";
import { buildAuthPortalVerificationUrl, sanitizeReturnTo } from "@/features/auth/lib/auth-portal";
import {
  ADMIN_CODE_VERIFIER_COOKIE,
  ADMIN_RETURN_TO_COOKIE,
  ADMIN_STATE_COOKIE,
  ADMIN_TOKEN_COOKIE,
  ADMIN_SESSION_COOKIE,
} from "@/features/auth/lib/cookie-names";

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function clearAuthCookies(response: NextResponse) {
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.cookies.delete(ADMIN_TOKEN_COOKIE);
  response.cookies.delete(ADMIN_CODE_VERIFIER_COOKIE);
  response.cookies.delete(ADMIN_STATE_COOKIE);
  response.cookies.delete(ADMIN_RETURN_TO_COOKIE);
}

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const verifierCookie = request.cookies.get(ADMIN_CODE_VERIFIER_COOKIE)?.value;
  const stateCookie = request.cookies.get(ADMIN_STATE_COOKIE)?.value;

  if (!verifierCookie || !stateCookie) {
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }

  try {
    const codeVerifier = await decrypt(verifierCookie);
    const expectedState = await decrypt(stateCookie);
    const tokens = await client.authorizationCodeGrant(
      config,
      new URL(request.url),
      {
        pkceCodeVerifier: codeVerifier,
        expectedState,
        idTokenExpected: true,
      }
    );

    const claims = tokens.claims()!;
    const emailVerified = toBoolean(claims.email_verified);

    const encryptedReturnTo = request.cookies.get(ADMIN_RETURN_TO_COOKIE)?.value;
    let returnToRaw: string | null = null;
    if (encryptedReturnTo) {
      try {
        returnToRaw = await decrypt(encryptedReturnTo);
      } catch {
        returnToRaw = null;
      }
    }

    if (!emailVerified) {
      const response = NextResponse.redirect(buildAuthPortalVerificationUrl());
      clearAuthCookies(response);
      return response;
    }

    await setSession(
      {
        idToken: tokens.id_token,
        expiresAt: claims.exp ?? Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: claims.sub,
          email: claims.email as string | undefined,
          name: claims.name as string | undefined,
          username: claims.preferred_username as string | undefined,
          emailVerified,
        },
      },
      tokens.access_token
    );

    const response = NextResponse.redirect(
      new URL(sanitizeReturnTo(returnToRaw), request.url)
    );
    response.cookies.delete(ADMIN_CODE_VERIFIER_COOKIE);
    response.cookies.delete(ADMIN_STATE_COOKIE);
    response.cookies.delete(ADMIN_RETURN_TO_COOKIE);
    return response;
  } catch (error) {
    const response = NextResponse.redirect(new URL("/?error=auth_failed", request.url));
    clearAuthCookies(response);
    return response;
  }
}
