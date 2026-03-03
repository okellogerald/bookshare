import { NextResponse } from "next/server";
import * as client from "openid-client";
import {
  getOIDCConfig,
  getPostLogoutRedirectUri,
} from "@/features/auth/lib/oidc";
import { getSession, clearSession } from "@/features/auth/lib/session";

export async function GET() {
  const config = await getOIDCConfig();
  const session = await getSession();

  await clearSession();

  // If we have an id_token, do a proper OIDC logout
  if (session?.idToken) {
    const logoutUrl = client.buildEndSessionUrl(config, {
      id_token_hint: session.idToken,
      post_logout_redirect_uri: getPostLogoutRedirectUri(),
    });

    return NextResponse.redirect(logoutUrl.href);
  }

  return NextResponse.redirect(getPostLogoutRedirectUri());
}
