import { cookies } from "next/headers";
import { encrypt, decrypt } from "./crypto";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_TOKEN_COOKIE,
} from "./cookie-names";

export interface SessionData {
  idToken?: string;
  expiresAt: number;
  user: {
    id: string;
    email?: string;
    name?: string;
    username?: string;
    emailVerified?: boolean;
    roles?: string[];
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
  // Admin API authorization depends on the platform-role claims we inject into
  // the ID token during Hydra consent. Prefer that token consistently here
  // instead of the access token, whose claim shape can lag during remembered
  // consent flows.
  const tokenForApi = data.idToken ?? accessToken;

  if (!tokenForApi) {
    throw new Error("Cannot persist an admin session without an API token");
  }

  cookieStore.set(ADMIN_SESSION_COOKIE, await encrypt(JSON.stringify(data)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  cookieStore.set(ADMIN_TOKEN_COOKIE, await encrypt(tokenForApi), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!value) return null;

  try {
    const session = JSON.parse(await decrypt(value)) as SessionData;
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
  const tokenCookie = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;

  if (tokenCookie) {
    try {
      const token = await decrypt(tokenCookie);
      if (isJwtLike(token)) return token;
    } catch {
      // Fall through to the session cookie.
    }
  }

  const session = await getSession();
  return isJwtLike(session?.idToken) ? session.idToken : null;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  cookieStore.delete(ADMIN_TOKEN_COOKIE);
}
