/**
 * Session Management — Web Client
 *
 * Two encrypted httpOnly cookies (AES-256-GCM, SameSite=Lax, 24h TTL):
 * - `bookshare_session`: SessionData (user info, expiry)
 * - `bookshare_token`: access token for API calls
 */
import { cookies } from "next/headers";
import { encrypt, decrypt } from "./crypto";
import { WEB_SESSION_COOKIE, WEB_TOKEN_COOKIE } from "./cookie-names";

export interface SessionData {
  idToken?: string;
  expiresAt: number;
  user: {
    id: string;
    email?: string;
    name?: string;
    username?: string;
    emailVerified?: boolean;
  };
}

function isJwtLike(token?: string | null): token is string {
  return !!token && token.split(".").length === 3;
}

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

  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24,
  };

  cookieStore.set(WEB_SESSION_COOKIE, await encrypt(JSON.stringify(data)), opts);
  cookieStore.set(WEB_TOKEN_COOKIE, await encrypt(tokenForApi), opts);
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(WEB_SESSION_COOKIE);

  if (!sessionCookie?.value) return null;

  try {
    const session: SessionData = JSON.parse(
      await decrypt(sessionCookie.value)
    );
    if (Date.now() > session.expiresAt * 1000) {
      await clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(WEB_TOKEN_COOKIE)?.value ?? null;

  if (tokenCookie) {
    try {
      const decrypted = await decrypt(tokenCookie);
      if (isJwtLike(decrypted)) return decrypted;
    } catch {
      // fall through
    }
  }

  const sessionCookie = cookieStore.get(WEB_SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const session: SessionData = JSON.parse(await decrypt(sessionCookie));
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
