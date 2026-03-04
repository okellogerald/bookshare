import { cookies } from "next/headers";

const SESSION_COOKIE = "bookshare_session";
const TOKEN_COOKIE = "bookshare_token";

interface SessionData {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
  user: {
    id: string;
    email?: string;
    name?: string;
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

  cookieStore.set(SESSION_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  cookieStore.set(TOKEN_COOKIE, tokenForApi, {
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
    const session: SessionData = JSON.parse(sessionCookie.value);

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
  if (isJwtLike(tokenCookie)) return tokenCookie;

  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return tokenCookie;

  try {
    const session: SessionData = JSON.parse(sessionCookie);
    if (isJwtLike(session.accessToken)) return session.accessToken;
    if (isJwtLike(session.idToken)) return session.idToken;
  } catch {
    return tokenCookie;
  }

  return tokenCookie;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(TOKEN_COOKIE);
}
