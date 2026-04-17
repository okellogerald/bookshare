/**
 * OAuth2 Callback — Web Client (Authorization Code Exchange)
 *
 * Completes the OAuth2 Authorization Code + PKCE flow. The browser arrives
 * here after Hydra has processed login and consent and redirected back with
 * an authorization `code` and `state`.
 *
 * Steps:
 * 1. Decrypt the OIDC transaction cookies saved during `/api/auth/login`.
 * 2. Exchange the authorization code for tokens at Hydra's token endpoint.
 * 3. Validate ID token claims — `email_verified` must be true.
 * 4. Persist the session (user data + access token) in encrypted httpOnly cookies.
 * 5. Call NestJS `/profiles/sync` to ensure the user's profile exists (best-effort).
 * 6. Redirect to the original destination.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  clearOIDCClientCookies,
  clearOIDCTransactionCookies,
  readOIDCTransaction,
} from "@bookshare/shared";
import * as client from "openid-client";
import { getOIDCConfig } from "@/domains/auth/lib/oidc";
import { setSession } from "@/domains/auth/lib/session";
import { decrypt } from "@/domains/auth/lib/crypto";
import { WEB_OIDC_COOKIE_NAMES } from "@/domains/auth/lib/cookie-names";

const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://api:3333/api";

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
  const transaction = await readOIDCTransaction({
    cookies: request.cookies,
    decrypt,
    cookieNames: WEB_OIDC_COOKIE_NAMES,
    defaultReturnTo: "/browse",
  });

  if (!transaction) {
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }

  try {
    const currentUrl = new URL(request.url);
    const tokens = await client.authorizationCodeGrant(
      config,
      currentUrl,
      {
        pkceCodeVerifier: transaction.codeVerifier,
        expectedState: transaction.expectedState,
        idTokenExpected: true,
      }
    );

    const claims = tokens.claims()!;
    const emailVerified = toBoolean(claims.email_verified);

    if (!emailVerified) {
      const response = NextResponse.redirect(
        new URL("/auth/verification", request.url)
      );
      clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
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

    const apiToken = resolveApiToken(tokens.access_token, tokens.id_token);
    if (apiToken) {
      try {
        const syncResponse = await fetch(`${API_URL}/profiles/sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiToken}` },
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
            clearOIDCClientCookies(blockedResponse.cookies, WEB_OIDC_COOKIE_NAMES);
            return blockedResponse;
          }

          console.error(
            `Profile sync failed with status ${syncResponse.status}: ${syncErrorText}`
          );
        }
      } catch (syncError) {
        console.error("Profile sync on callback failed:", syncError);
      }
    }

    const response = NextResponse.redirect(
      new URL(transaction.returnTo, request.url)
    );
    clearOIDCTransactionCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
    return response;
  } catch (error) {
    console.error("OIDC callback error:", error);
    const response = NextResponse.redirect(
      new URL("/?error=auth_failed", request.url)
    );
    clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
    return response;
  }
}
