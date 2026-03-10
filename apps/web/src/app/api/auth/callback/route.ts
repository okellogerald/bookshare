import { NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";
import { getOIDCConfig } from "@/features/auth/lib/oidc";
import { setSession } from "@/features/auth/lib/session";

const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://api:3333/api";

function sanitizeReturnTo(value: string | null): string {
  if (!value) return "/browse";
  if (!value.startsWith("/")) return "/browse";
  if (value.startsWith("//")) return "/browse";
  if (value.startsWith("/api/auth")) return "/browse";
  return value;
}

function isJwtLike(token?: string | null): token is string {
  return !!token && token.split(".").length === 3;
}

function resolveApiToken(
  accessToken?: string | null,
  idToken?: string | null
) {
  if (isJwtLike(accessToken)) return accessToken;
  if (isJwtLike(idToken)) return idToken;
  return accessToken ?? idToken ?? null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
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
    const emailVerified = toBoolean(claims.email_verified);
    const returnTo = sanitizeReturnTo(
      request.cookies.get("oidc_return_to")?.value ?? null
    );

    if (!emailVerified) {
      const verificationUrl = new URL("/auth/verification", request.url);
      verificationUrl.searchParams.set("returnTo", returnTo);

      const response = NextResponse.redirect(verificationUrl);
      response.cookies.delete("bookshare_session");
      response.cookies.delete("bookshare_token");
      response.cookies.delete("oidc_code_verifier");
      response.cookies.delete("oidc_state");
      response.cookies.delete("oidc_return_to");
      return response;
    }

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
        emailVerified,
      },
    });

    const apiToken = resolveApiToken(tokens.access_token, tokens.id_token);
    if (apiToken) {
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${apiToken}`,
        };
        if (tokens.access_token) {
          headers["x-auth-access-token"] = tokens.access_token;
        }

        const syncResponse = await fetch(`${API_URL}/profiles/sync`, {
          method: "POST",
          headers,
        });
        if (!syncResponse.ok) {
          const syncErrorText = await syncResponse.text();

          if (
            syncResponse.status === 401 &&
            syncErrorText.toLowerCase().includes("deactivated")
          ) {
            const blockedResponse = NextResponse.redirect(
              new URL("/?error=account_deactivated", request.url)
            );
            blockedResponse.cookies.delete("bookshare_session");
            blockedResponse.cookies.delete("bookshare_token");
            blockedResponse.cookies.delete("oidc_code_verifier");
            blockedResponse.cookies.delete("oidc_state");
            blockedResponse.cookies.delete("oidc_return_to");
            return blockedResponse;
          }

          console.error(
            `Profile sync on callback failed with status ${syncResponse.status}: ${syncErrorText}`
          );
        }
      } catch (syncError) {
        console.error("Profile sync on callback failed:", syncError);
      }
    }

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
