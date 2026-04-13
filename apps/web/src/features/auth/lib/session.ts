/**
 * Session Management — Web Client
 *
 * Manages the encrypted server-side session that persists after OAuth2 login.
 * Two cookies are used (both AES-256-GCM encrypted, httpOnly, SameSite=Lax):
 *
 * - `bookshare_session`: contains the SessionData object (user info, expiry,
 *   DPoP private key JWK). Read by middleware for route protection and by
 *   `apiFetch` for DPoP proof creation.
 *
 * - `bookshare_token`: contains the access token used for Resource Server
 *   API calls. Stored separately so `getAccessToken()` doesn't need to
 *   decrypt the full session for every API call.
 *
 * Both cookies have a 24-hour TTL. The session's `expiresAt` field (derived
 * from the ID token's `exp` claim) provides the logical expiry check.
 *
 * @see `crypto.ts` — AES-256-GCM encryption/decryption
 * @see `api-client.ts` — uses getAccessToken() + getSession() for API calls
 * @see `/api/auth/callback` — where the session is created after login
 */
import { cookies } from "next/headers";
import { encrypt, decrypt } from "./crypto";
import {
  WEB_SESSION_COOKIE,
  WEB_TOKEN_COOKIE,
} from "./cookie-names";

/**
 * Shape of the encrypted session stored in the `bookshare_session` cookie.
 *
 * - idToken: the raw JWT from Hydra, used as id_token_hint during logout
 * - expiresAt: Unix timestamp (seconds) from the ID token's `exp` claim
 * - dpopJwk: ECDSA P-256 private key JWK for creating DPoP proofs; only
 *   present when the access token was DPoP-bound during the callback
 * - user: identity claims extracted from the ID token during callback
 */
export interface SessionData {
  idToken?: string;
  expiresAt: number;
  dpopJwk?: JsonWebKey;
  user: {
    id: string;
    email?: string;
    name?: string;
    username?: string;
    emailVerified?: boolean;
  };
}

/** Quick structural check — a JWT has exactly three dot-separated segments. */
function isJwtLike(token?: string | null): token is string {
  return !!token && token.split(".").length === 3;
}

/**
 * Persist a new session after successful OAuth2 callback.
 *
 * Encrypts SessionData and the access token into separate cookies. The access
 * token is stored separately for efficient retrieval by `apiFetch` — most API
 * calls only need the token, not the full session.
 *
 * Token selection: prefers the access_token if it's a JWT (most Hydra configs);
 * falls back to idToken for setups where access_token is opaque.
 */
export async function setSession(
  data: SessionData,
  accessToken?: string | null
): Promise<void> {
  const cookieStore = await cookies();
  const tokenForApi = isJwtLike(accessToken)
    ? accessToken
    : data.idToken ?? accessToken;

  if (!tokenForApi) {
    throw new Error("Cannot persist a session without an API token");
  }

  const encryptedSession = await encrypt(JSON.stringify(data));
  const encryptedToken = await encrypt(tokenForApi);

  cookieStore.set(WEB_SESSION_COOKIE, encryptedSession, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  cookieStore.set(WEB_TOKEN_COOKIE, encryptedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

/**
 * Retrieve and validate the current session.
 * Returns null if no session exists, decryption fails, or the session is expired.
 * Used by middleware (route protection), apiFetch (DPoP key), and logout (id_token_hint).
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(WEB_SESSION_COOKIE);

  if (!sessionCookie?.value) return null;

  try {
    const decrypted = await decrypt(sessionCookie.value);
    const session: SessionData = JSON.parse(decrypted);

    if (Date.now() > session.expiresAt * 1000) {
      await clearSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Retrieve the access token for API calls.
 * Tries the dedicated token cookie first (faster — no session parsing needed).
 * Falls back to extracting the idToken from the session if the token cookie
 * is missing or corrupted.
 */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(WEB_TOKEN_COOKIE)?.value ?? null;

  if (tokenCookie) {
    try {
      const decryptedToken = await decrypt(tokenCookie);
      if (isJwtLike(decryptedToken)) return decryptedToken;
    } catch {
      // Fall through to session cookie
    }
  }

  const sessionCookie = cookieStore.get(WEB_SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const decrypted = await decrypt(sessionCookie);
    const session: SessionData = JSON.parse(decrypted);
    if (isJwtLike(session.idToken)) return session.idToken;
  } catch {
    return null;
  }

  return null;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(WEB_SESSION_COOKIE);
  cookieStore.delete(WEB_TOKEN_COOKIE);
}
