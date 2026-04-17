/**
 * Cookie Names — Web Client
 *
 * Central registry of all cookie names used by the Web app's auth system.
 * Keeping them in one place prevents typos and makes it easy to see the
 * full cookie surface area.
 *
 * Persistent cookies (survive login):
 * - session: encrypted SessionData (user info, expiry)
 * - token: encrypted access token for API calls
 * - loggedOut: marker set after explicit logout (affects middleware redirect)
 *
 * Transient cookies (OIDC transaction, cleared after callback):
 * - codeVerifier: PKCE code_verifier for the token exchange
 * - state: CSRF protection state for the OAuth redirect
 * - returnTo: where to send the user after login completes
 */
export const WEB_SESSION_COOKIE = "bookshare_session";
export const WEB_TOKEN_COOKIE = "bookshare_token";
export const WEB_LOGGED_OUT_COOKIE = "bookshare_logged_out";
export const WEB_CODE_VERIFIER_COOKIE = "oidc_code_verifier";
export const WEB_STATE_COOKIE = "oidc_state";
export const WEB_RETURN_TO_COOKIE = "oidc_return_to";

/** Typed map of all Web app cookie names — passed to shared OIDC utilities. */
export const WEB_OIDC_COOKIE_NAMES = {
  session: WEB_SESSION_COOKIE,
  token: WEB_TOKEN_COOKIE,
  loggedOut: WEB_LOGGED_OUT_COOKIE,
  codeVerifier: WEB_CODE_VERIFIER_COOKIE,
  state: WEB_STATE_COOKIE,
  returnTo: WEB_RETURN_TO_COOKIE,
} as const;
