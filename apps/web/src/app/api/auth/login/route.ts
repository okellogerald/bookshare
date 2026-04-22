/**
 * OAuth2 Login Initiation — Web Client
 *
 * This is the entry point of the entire authentication flow for the Web app.
 * When a user needs to log in (either by clicking "Login" or being redirected
 * by the middleware after hitting a protected route), the browser arrives here.
 *
 * What this route does:
 * 1. Creates a PKCE transaction (code_verifier + code_challenge) so that only
 *    the party that started the flow can exchange the authorization code later.
 * 2. Generates a cryptographic `state` parameter to prevent CSRF attacks on
 *    the OAuth redirect.
 * 3. Encrypts these values into short-lived cookies (10 min TTL) so they
 *    survive the browser redirect dance through Hydra and Auth-Portal.
   * 4. Builds the Hydra authorization URL with `prompt=login max_age=0` for
   *    normal logins. Auth-Portal resolver handoffs pass `handoff=1` and reuse
   *    the fresh Kratos session without forcing another password entry.
 * 5. Redirects the browser to Hydra, kicking off the OAuth2 Authorization
 *    Code + PKCE flow.
 *
 * After Hydra processes the login and consent challenges (via Auth-Portal),
 * it redirects back to `/api/auth/callback` with an authorization code.
 *
 * @see `/api/auth/callback` — where the code is exchanged for tokens
 * @see `auth/web/src/app/oauth/login/route.ts` — Auth-Portal login challenge handler
 */
import { NextRequest, NextResponse } from "next/server";
import {
  buildScope,
  clearLoggedOutMarker,
  createLoginTransaction,
  persistOIDCTransaction,
} from "@bookshare/shared";
import { createLogger } from "@bookshare/logger";
import * as client from "openid-client";
import { getOIDCConfig, getRedirectUri } from "@/domains/auth/lib/oidc";
import { encrypt } from "@/domains/auth/lib/crypto";
import { WEB_OIDC_COOKIE_NAMES } from "@/domains/auth/lib/cookie-names";

const logger = createLogger({ service: "web-auth" }).child({
  route: "api.auth.login",
});

export async function GET(request: NextRequest) {
  // Discover Hydra's OIDC metadata (authorization endpoint, token endpoint, etc.)
  const config = await getOIDCConfig();
  const redirectUri = getRedirectUri();

  // Request standard OIDC scopes plus offline_access for refresh tokens.
  // offline_access asks Hydra to issue a refresh_token alongside the access_token.
  const scope = buildScope(
    ["openid", "profile", "email"],
    process.env.OIDC_ADDITIONAL_SCOPES || "offline_access"
  );

  // Generate the PKCE transaction: a random code_verifier, its SHA-256 hash
  // (code_challenge), a CSRF state, and the sanitized return-to destination.
  const transaction = await createLoginTransaction({
    requestedReturnTo: request.nextUrl.searchParams.get("returnTo"),
    defaultReturnTo: "/browse",
  });

  const isResolverHandoff = request.nextUrl.searchParams.get("handoff") === "1";

  // Build the full authorization URL that the browser will be redirected to.
  // Normal user-initiated login forces a fresh login screen. Resolver handoff
  // omits prompt/max_age so the just-validated Kratos session can be reused
  // when moving the user from one first-party client to another.
  const authorizationParams: Record<string, string> = {
    redirect_uri: redirectUri,
    scope,
    code_challenge: transaction.codeChallenge,
    code_challenge_method: "S256",
    state: transaction.state,
  };

  if (!isResolverHandoff) {
    authorizationParams.prompt = "login";
    authorizationParams.max_age = "0";
  }

  const authorizationUrl = client.buildAuthorizationUrl(config, authorizationParams);
  const response = NextResponse.redirect(authorizationUrl.href);

  // Encrypt and store the PKCE verifier, state, and returnTo as httpOnly
  // cookies (10 min TTL). These are consumed by /api/auth/callback after
  // Hydra redirects back with the authorization code.
  await persistOIDCTransaction({
    cookies: response.cookies,
    encrypt,
    cookieNames: WEB_OIDC_COOKIE_NAMES,
    transaction,
  });

  // Clear any previous logged-out marker so middleware doesn't redirect
  // the user to the landing page after they've initiated a fresh login.
  clearLoggedOutMarker(response.cookies, WEB_OIDC_COOKIE_NAMES.loggedOut);

  logger.info(
    {
      returnTo: transaction.returnTo,
      resolverHandoff: isResolverHandoff,
      authorizationHost: authorizationUrl.host,
      authorizationPath: authorizationUrl.pathname,
      scope,
    },
    "Started OAuth login"
  );

  return response;
}
