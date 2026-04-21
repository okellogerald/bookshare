import type { OIDCClientCookieNames } from "@bookshare/shared";

export const AUTH_ORG_SESSION_COOKIE = "auth_org_session";
export const AUTH_ORG_TOKEN_COOKIE = "auth_org_token";
export const AUTH_ORG_LOGGED_OUT_COOKIE = "auth_org_logged_out";

export const AUTH_ORG_OIDC_COOKIE_NAMES: OIDCClientCookieNames = {
  codeVerifier: "auth_org_oidc_code_verifier",
  state: "auth_org_oidc_state",
  returnTo: "auth_org_oidc_return_to",
  session: AUTH_ORG_SESSION_COOKIE,
  token: AUTH_ORG_TOKEN_COOKIE,
  loggedOut: AUTH_ORG_LOGGED_OUT_COOKIE,
};
