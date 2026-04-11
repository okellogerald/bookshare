export const WEB_SESSION_COOKIE = "bookshare_session";
export const WEB_TOKEN_COOKIE = "bookshare_token";
export const WEB_LOGGED_OUT_COOKIE = "bookshare_logged_out";
export const WEB_CODE_VERIFIER_COOKIE = "oidc_code_verifier";
export const WEB_STATE_COOKIE = "oidc_state";
export const WEB_RETURN_TO_COOKIE = "oidc_return_to";

export const WEB_OIDC_COOKIE_NAMES = {
  session: WEB_SESSION_COOKIE,
  token: WEB_TOKEN_COOKIE,
  loggedOut: WEB_LOGGED_OUT_COOKIE,
  codeVerifier: WEB_CODE_VERIFIER_COOKIE,
  state: WEB_STATE_COOKIE,
  returnTo: WEB_RETURN_TO_COOKIE,
} as const;
