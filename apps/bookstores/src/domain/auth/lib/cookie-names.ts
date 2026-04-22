/**
 * Cookie Names — Bookstores Client
 *
 * Same structure as the Web app but with `bookshare_bookstores_` prefixed names
 * to avoid cookie collisions when both apps run on the same domain during
 * development (both on localhost, different ports).
 *
 * @see `apps/web/src/features/auth/lib/cookie-names.ts` — Web app equivalent
 */
export const BOOKSTORES_SESSION_COOKIE = "bookshare_bookstores_session";
export const BOOKSTORES_TOKEN_COOKIE = "bookshare_bookstores_token";
export const BOOKSTORES_LOGGED_OUT_COOKIE = "bookshare_bookstores_logged_out";
export const BOOKSTORES_ACTIVE_ORG_COOKIE =
  "bookshare_bookstores_active_org";
export const BOOKSTORES_CODE_VERIFIER_COOKIE =
  "bookshare_bookstores_oidc_code_verifier";
export const BOOKSTORES_STATE_COOKIE = "bookshare_bookstores_oidc_state";
export const BOOKSTORES_RETURN_TO_COOKIE = "bookshare_bookstores_oidc_return_to";

export const BOOKSTORES_OIDC_COOKIE_NAMES = {
  session: BOOKSTORES_SESSION_COOKIE,
  token: BOOKSTORES_TOKEN_COOKIE,
  loggedOut: BOOKSTORES_LOGGED_OUT_COOKIE,
  codeVerifier: BOOKSTORES_CODE_VERIFIER_COOKIE,
  state: BOOKSTORES_STATE_COOKIE,
  returnTo: BOOKSTORES_RETURN_TO_COOKIE,
} as const;
