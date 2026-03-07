import { NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import { getOIDCConfig } from "@/features/auth/lib/oidc";
import { setSession } from "@/features/auth/lib/session";

function sanitizeReturnTo(value: string | null): string {
  if (!value) return "/browse";
  if (!value.startsWith("/")) return "/browse";
  if (value.startsWith("//")) return "/browse";
  if (value.startsWith("/api/auth")) return "/browse";
  return value;
}

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();

  const codeVerifier = request.cookies.get("oidc_code_verifier")?.value;
  const expectedState = request.cookies.get("oidc_state")?.value;

  if (!codeVerifier || !expectedState) {
    return NextResponse.redirect(
      new URL("/api/auth/login", request.url)
    );
  }

  try {
    const currentUrl = new URL(request.url);
    const tokens = await client.authorizationCodeGrant(
      config,
      currentUrl,
      {
        pkceCodeVerifier: codeVerifier,
        expectedState,
        idTokenExpected: true,
      }
    );

    const claims = tokens.claims()!;

    await setSession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt:
        claims.exp ?? Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: claims.sub,
        email: claims.email as string | undefined,
        name: claims.name as string | undefined,
        username: claims.preferred_username as string | undefined,
      },
    });

    const returnTo = sanitizeReturnTo(
      request.cookies.get("oidc_return_to")?.value ?? null
    );

    // Clean up OIDC cookies and redirect back to requested route
    const response = NextResponse.redirect(new URL(returnTo, request.url));
    response.cookies.delete("oidc_code_verifier");
    response.cookies.delete("oidc_state");
    response.cookies.delete("oidc_return_to");

    return response;
  } catch (error) {
    console.error("OIDC callback error:", error);
    return NextResponse.redirect(
      new URL("/?error=auth_failed", request.url)
    );
  }
}
