import { NextResponse } from "next/server";
import {
  buildEndSessionParams,
  clearOIDCClientCookies,
  setLoggedOutMarker,
} from "@bookshare/shared";
import { createLogger } from "@bookshare/logger";
import * as client from "openid-client";
import { getOIDCConfig } from "@/domains/auth/lib/oidc";
import { buildAppPostLogoutUrl } from "@/domains/auth/lib/auth-portal";
import { getSession } from "@/domains/auth/lib/session";
import { WEB_OIDC_COOKIE_NAMES } from "@/domains/auth/lib/cookie-names";

const logger = createLogger({ service: "web-auth" }).child({
  route: "api.auth.logout",
});

export async function GET() {
  const postLogoutRedirectUri = buildAppPostLogoutUrl();
  const session = await getSession();
  let redirectTarget = postLogoutRedirectUri;

  try {
    const config = await getOIDCConfig();
    const params = buildEndSessionParams({
      postLogoutRedirectUri,
      clientId: process.env.OIDC_CLIENT_ID,
      idTokenHint: session?.idToken,
    });
    redirectTarget = client.buildEndSessionUrl(config, params).href;
  } catch (error) {
    logger.warn(
      { err: error },
      "Failed to build Hydra end-session URL; falling back to post-logout"
    );
  }

  const response = NextResponse.redirect(redirectTarget);
  clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
  setLoggedOutMarker(response.cookies, WEB_OIDC_COOKIE_NAMES.loggedOut);

  logger.info(
    { hasIdTokenHint: Boolean(session?.idToken) },
    "Started web logout"
  );

  return response;
}
