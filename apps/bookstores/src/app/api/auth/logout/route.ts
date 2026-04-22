import { NextResponse } from "next/server";
import {
  buildEndSessionParams,
  clearOIDCClientCookies,
  setLoggedOutMarker,
} from "@bookshare/shared";
import { createLogger } from "@bookshare/logger";
import * as client from "openid-client";
import { getOIDCConfig } from "@/domain/auth/lib/oidc";
import { buildAppPostLogoutUrl } from "@/domain/auth/lib/auth-portal";
import { getSession } from "@/domain/auth/lib/session";
import {
  BOOKSTORES_ACTIVE_ORG_COOKIE,
  BOOKSTORES_OIDC_COOKIE_NAMES,
} from "@/domain/auth/lib/cookie-names";

const logger = createLogger({ service: "bookstores-auth" }).child({
  route: "api.auth.logout",
});

export async function GET() {
  const postLogoutRedirectUri = buildAppPostLogoutUrl();
  const config = await getOIDCConfig();
  const session = await getSession();
  const params = buildEndSessionParams({
    postLogoutRedirectUri,
    clientId: process.env.OIDC_CLIENT_ID,
    idTokenHint: session?.idToken,
  });

  let redirectTarget = postLogoutRedirectUri;
  try {
    redirectTarget = client.buildEndSessionUrl(config, params).href;
  } catch (error) {
    logger.warn(
      { err: error },
      "Failed to build Hydra end-session URL; falling back to post-logout"
    );
    redirectTarget = postLogoutRedirectUri;
  }

  const response = NextResponse.redirect(redirectTarget);
  clearOIDCClientCookies(response.cookies, BOOKSTORES_OIDC_COOKIE_NAMES);
  response.cookies.delete(BOOKSTORES_ACTIVE_ORG_COOKIE);
  setLoggedOutMarker(response.cookies, BOOKSTORES_OIDC_COOKIE_NAMES.loggedOut);
  logger.info(
    { hasIdTokenHint: Boolean(session?.idToken) },
    "Started bookstores logout"
  );

  return response;
}
