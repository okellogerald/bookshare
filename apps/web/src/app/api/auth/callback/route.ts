/**
 * OAuth2 Callback — Web Client (Authorization Code Exchange)
 *
 * This route completes the OAuth2 Authorization Code + PKCE flow. The browser
 * arrives here after Hydra has processed both the login and consent challenges
 * (via Auth-Portal) and redirected back with an authorization `code` and `state`.
 *
 * What this route does:
 * 1. Decrypts the OIDC transaction cookies saved during `/api/auth/login`
 *    to recover the PKCE code_verifier, expected state, and returnTo destination.
 * 2. Generates a DPoP keypair (ECDSA P-256) and exchanges the authorization
 *    code for tokens at Hydra's token endpoint (server-to-server, never browser).
 *    DPoP binds the access token to this specific keypair, so a stolen token
 *    is useless without the private key.
 * 3. Validates the ID token claims — specifically `email_verified` must be true.
 * 4. Persists the session: encrypts user data + tokens into httpOnly cookies
 *    with AES-256-GCM. The DPoP private key JWK is stored in the session so
 *    subsequent API calls can create fresh DPoP proofs.
 * 5. Calls the NestJS API's `/profiles/sync` endpoint to ensure the user's
 *    profile exists in the resource server's database. This is a best-effort
 *    call — failures don't block login.
 * 6. Redirects the user to their original destination (e.g., /my-library).
 *
 * @see `/api/auth/login` — where this flow starts
 * @see `apps/auth/src/app/oauth/consent/route.ts` — where token claims are built
 * @see `dpop.ts` — DPoP proof creation for subsequent API calls
 */
import { NextRequest, NextResponse } from "next/server";
import {
  clearOIDCClientCookies,
  clearOIDCTransactionCookies,
  readOIDCTransaction,
} from "@bookshare/shared";
import * as client from "openid-client";
import { getOIDCConfig } from "@/features/auth/lib/oidc";
import { setSession } from "@/features/auth/lib/session";
import { decrypt } from "@/features/auth/lib/crypto";
import {
  generateDPoPKeyPair,
  exportPrivateKeyJwk,
  createDPoPProof,
  tokenHasDpopBinding,
} from "@/features/auth/lib/dpop";
import { WEB_OIDC_COOKIE_NAMES } from "@/features/auth/lib/cookie-names";

/** Internal URL for the NestJS resource server (server-to-server). */
const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://api:3333/api";

/** Quick structural check — a JWT has exactly three dot-separated segments. */
function isJwtLike(token?: string | null): token is string {
  return !!token && token.split(".").length === 3;
}

/**
 * Picks the best token for authenticating with the NestJS API.
 * Prefers the access_token (which carries audience/scope), falling back to
 * the id_token if the access_token is opaque (non-JWT).
 */
function resolveApiToken(
  accessToken?: string | null,
  idToken?: string | null
) {
  if (isJwtLike(accessToken)) return accessToken;
  if (isJwtLike(idToken)) return idToken;
  return accessToken ?? idToken ?? null;
}

/** Normalizes claim values to boolean — Hydra may encode them as strings. */
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

  // If transaction cookies are missing or corrupted, the user probably arrived
  // at /callback without a valid login initiation — restart the flow.
  if (!transaction) {
    return NextResponse.redirect(
      new URL("/api/auth/login", request.url)
    );
  }

  try {
    // --- Step 1: Token Exchange with DPoP ---
    // Generate a fresh ECDSA P-256 keypair for DPoP (RFC 9449). This key is
    // ephemeral to this login — the private key will be stored in the encrypted
    // session cookie so that subsequent API calls can mint fresh DPoP proofs.
    const dpopKeyPair = await generateDPoPKeyPair();
    const dpopHandle = client.getDPoPHandle(config, dpopKeyPair);

    // Exchange the authorization code for tokens at Hydra's token endpoint.
    // This is a server-to-server call (uses OIDC_TOKEN_ENDPOINT / internal URL).
    // - pkceCodeVerifier: proves we are the same party that initiated the flow
    // - expectedState: CSRF validation against the state we stored in cookies
    // - DPoP: attaches a DPoP proof to the token request so Hydra can bind
    //   the access token to our public key (via the `cnf.jkt` claim)
    const currentUrl = new URL(request.url);
    const tokens = await client.authorizationCodeGrant(
      config,
      currentUrl,
      {
        pkceCodeVerifier: transaction.codeVerifier,
        expectedState: transaction.expectedState,
        idTokenExpected: true,
      },
      undefined,
      { DPoP: dpopHandle }
    );

    // --- Step 2: Validate Identity Claims ---
    // The ID token claims were populated during the consent step by Auth-Portal,
    // which pulled them from the Kratos session and the staff_roles table.
    const claims = tokens.claims()!;
    const emailVerified = toBoolean(claims.email_verified);
    const accessTokenIsDpopBound =
      !!tokens.access_token && tokenHasDpopBinding(tokens.access_token);

    // Hard gate: unverified emails cannot proceed. Redirect to Auth-Portal's
    // verification page without creating a session.
    if (!emailVerified) {
      const response = NextResponse.redirect(new URL("/auth/verification", request.url));
      clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
      return response;
    }

    // --- Step 3: Persist DPoP Key ---
    // Only store the private key JWK if the access token is actually DPoP-bound
    // (has cnf.jkt claim). If Hydra didn't bind the token (e.g., DPoP not
    // configured), we fall back to plain Bearer auth for API calls.
    const dpopJwk = accessTokenIsDpopBound
      ? await exportPrivateKeyJwk(dpopKeyPair)
      : undefined;

    if (tokens.access_token && !accessTokenIsDpopBound) {
      console.warn(
        "OIDC token response did not include cnf.jkt; falling back to Bearer for API requests."
      );
    }

    // --- Step 4: Create Encrypted Session ---
    // Encrypts user data and tokens into two httpOnly cookies:
    // - bookshare_session: SessionData (user info, expiry, DPoP key)
    // - bookshare_token: access token (for API calls via apiFetch)
    // Both encrypted with AES-256-GCM. 24-hour TTL.
    await setSession({
      idToken: tokens.id_token,
      expiresAt:
        claims.exp ?? Math.floor(Date.now() / 1000) + 3600,
      dpopJwk,
      user: {
        id: claims.sub,
        email: claims.email as string | undefined,
        name: claims.name as string | undefined,
        username: claims.preferred_username as string | undefined,
        emailVerified,
      },
    }, tokens.access_token);

    // --- Step 5: Profile Sync (best-effort) ---
    // Ensure the user's profile exists in the NestJS resource server DB.
    // This call creates or updates the profile record from the identity claims.
    // Failures are logged but never block login — the user can still proceed.
    // Exception: a 401 with "deactivated" means the account is banned.
    const apiToken = resolveApiToken(tokens.access_token, tokens.id_token);
    if (apiToken) {
      try {
        const syncUrl = `${API_URL}/profiles/sync`;
        const headers: Record<string, string> = {};

        // Use DPoP auth if the token is DPoP-bound, otherwise plain Bearer.
        if (dpopJwk && tokenHasDpopBinding(apiToken)) {
          const dpopProof = await createDPoPProof(dpopJwk, "POST", syncUrl, apiToken);
          headers["Authorization"] = `DPoP ${apiToken}`;
          headers["DPoP"] = dpopProof;
        } else {
          headers["Authorization"] = `Bearer ${apiToken}`;
        }

        // Pass the raw access_token as a secondary header for the API to
        // introspect if its primary auth mechanism differs.
        if (tokens.access_token) {
          headers["x-auth-access-token"] = tokens.access_token;
        }

        const syncResponse = await fetch(syncUrl, {
          method: "POST",
          headers,
        });
        if (!syncResponse.ok) {
          const syncErrorText = await syncResponse.text();

          // A deactivated account is a hard block — clear everything and
          // redirect to the landing page with an error.
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
            `Profile sync on callback failed with status ${syncResponse.status}: ${syncErrorText}`
          );
        }
      } catch (syncError) {
        console.error("Profile sync on callback failed:", syncError);
      }
    }

    // --- Step 6: Redirect to Original Destination ---
    // Clean up the OIDC transaction cookies (code_verifier, state, returnTo)
    // and send the user to where they originally wanted to go.
    const response = NextResponse.redirect(new URL(transaction.returnTo, request.url));
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
