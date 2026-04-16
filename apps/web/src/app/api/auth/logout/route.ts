/**
 * OAuth2 Logout Initiation — Web Client
 *
 * Starts the three-phase logout process that clears sessions across all layers:
 *
 * Phase 1 (here): Clear all client-side cookies (session, token, OIDC transaction
 *   cookies) and redirect to Hydra's end-session endpoint with the `id_token_hint`
 *   so Hydra can validate the logout request.
 *
 * Phase 2 (Hydra → Auth-Portal /oauth/logout): Hydra creates a logout_challenge,
 *   Auth-Portal accepts it, Hydra invalidates its OAuth session, then redirects
 *   to the `post_logout_redirect_uri`.
 *
 * Phase 3 (/api/auth/post-logout → Auth-Portal /logout → Kratos): Clears the
 *   Kratos session cookie so the identity provider forgets the user too.
 *
 * Result: all three sessions are destroyed — client app, Hydra, Kratos.
 *
 * @see `/api/auth/post-logout` — intermediate redirect after Hydra logout
 * @see `apps/auth/src/app/oauth/logout/route.ts` — Hydra logout challenge handler
 * @see `apps/auth/src/app/logout/route.ts` — Kratos session termination
 */
import { NextResponse } from "next/server";
import {
  buildEndSessionParams,
  clearOIDCClientCookies,
  setLoggedOutMarker,
} from "@bookshare/shared";
import * as client from "openid-client";
import {
  getOIDCConfig,
} from "@/domains/auth/lib/oidc";
import { buildAppPostLogoutUrl } from "@/domains/auth/lib/auth-portal";
import { getSession } from "@/domains/auth/lib/session";
import { WEB_OIDC_COOKIE_NAMES } from "@/domains/auth/lib/cookie-names";

export async function GET() {
  // After Hydra completes its logout, it will redirect the browser here.
  // This intermediate route then redirects to Auth-Portal to clear Kratos.
  const postLogoutRedirectUri = buildAppPostLogoutUrl();
  const config = await getOIDCConfig();
  const session = await getSession();

  // id_token_hint lets Hydra verify the logout request belongs to this session
  // without requiring a separate authentication step.
  const params = buildEndSessionParams({
    postLogoutRedirectUri,
    clientId: process.env.OIDC_CLIENT_ID,
    idTokenHint: session?.idToken,
  });

  // Build Hydra's RP-initiated logout URL. If config discovery fails,
  // skip Hydra and go directly to the post-logout handler.
  let redirectTarget = postLogoutRedirectUri;
  try {
    redirectTarget = client.buildEndSessionUrl(config, params).href;
  } catch {
    redirectTarget = postLogoutRedirectUri;
  }

  const response = NextResponse.redirect(redirectTarget);

  // Clear all client-side auth cookies immediately — don't wait for Hydra.
  clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);

  // Set a marker so middleware knows the user explicitly logged out and
  // should see the landing page (not be auto-redirected to login).
  setLoggedOutMarker(response.cookies, WEB_OIDC_COOKIE_NAMES.loggedOut);

  return response;
}
