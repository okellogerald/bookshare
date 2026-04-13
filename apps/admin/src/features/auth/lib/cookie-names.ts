/**
 * Cookie Names — Admin Client
 *
 * Same structure as the Web app but with `bookshare_admin_` prefixed names
 * to avoid cookie collisions when both apps run on the same domain during
 * development (both on localhost, different ports).
 *
 * @see `apps/web/src/features/auth/lib/cookie-names.ts` — Web app equivalent
 */
export const ADMIN_SESSION_COOKIE = "bookshare_admin_session";
export const ADMIN_TOKEN_COOKIE = "bookshare_admin_token";
export const ADMIN_LOGGED_OUT_COOKIE = "bookshare_admin_logged_out";
export const ADMIN_CODE_VERIFIER_COOKIE = "bookshare_admin_oidc_code_verifier";
export const ADMIN_STATE_COOKIE = "bookshare_admin_oidc_state";
export const ADMIN_RETURN_TO_COOKIE = "bookshare_admin_oidc_return_to";

export const ADMIN_OIDC_COOKIE_NAMES = {
  session: ADMIN_SESSION_COOKIE,
  token: ADMIN_TOKEN_COOKIE,
  loggedOut: ADMIN_LOGGED_OUT_COOKIE,
  codeVerifier: ADMIN_CODE_VERIFIER_COOKIE,
  state: ADMIN_STATE_COOKIE,
  returnTo: ADMIN_RETURN_TO_COOKIE,
} as const;
