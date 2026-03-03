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

export async function setSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  cookieStore.set(TOKEN_COOKIE, data.accessToken, {
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
  return cookieStore.get(TOKEN_COOKIE)?.value ?? null;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(TOKEN_COOKIE);
}
