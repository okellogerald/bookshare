import { cookies } from "next/headers";
import { encrypt, decrypt } from "./crypto";

const SESSION_COOKIE = "bookshare_session";
const TOKEN_COOKIE = "bookshare_token";

export interface SessionData {
  accessToken: string;
  refreshToken?: string;
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

function isJwtLike(token?: string | null): token is string {
  return !!token && token.split(".").length === 3;
}

export async function setSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  const tokenForApi = isJwtLike(data.accessToken)
    ? data.accessToken
    : data.idToken ?? data.accessToken;

  const encryptedSession = await encrypt(JSON.stringify(data));
  const encryptedToken = await encrypt(tokenForApi);

  cookieStore.set(SESSION_COOKIE, encryptedSession, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  cookieStore.set(TOKEN_COOKIE, encryptedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

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

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(TOKEN_COOKIE)?.value ?? null;

  if (tokenCookie) {
    try {
      const decryptedToken = await decrypt(tokenCookie);
      if (isJwtLike(decryptedToken)) return decryptedToken;
    } catch {
      // Fall through to session cookie
    }
  }

  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const decrypted = await decrypt(sessionCookie);
    const session: SessionData = JSON.parse(decrypted);
    if (isJwtLike(session.accessToken)) return session.accessToken;
    if (isJwtLike(session.idToken)) return session.idToken;
  } catch {
    return null;
  }

  return null;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(TOKEN_COOKIE);
}
