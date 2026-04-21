import { cookies } from "next/headers";
import { decrypt, encrypt } from "./crypto";
import {
  AUTH_ORG_SESSION_COOKIE,
  AUTH_ORG_TOKEN_COOKIE,
} from "./cookie-names";

export interface OrganizationSessionData {
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

export async function setOrganizationSession(
  data: OrganizationSessionData,
  accessToken?: string | null
) {
  const cookieStore = await cookies();
  const tokenForApi = data.idToken ?? accessToken;
  if (!tokenForApi) {
    throw new Error("Cannot persist an organization session without an API token");
  }

  cookieStore.set(AUTH_ORG_SESSION_COOKIE, await encrypt(JSON.stringify(data)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  cookieStore.set(AUTH_ORG_TOKEN_COOKIE, await encrypt(tokenForApi), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function getOrganizationSession(): Promise<OrganizationSessionData | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(AUTH_ORG_SESSION_COOKIE)?.value;
  if (!value) return null;

  try {
    const session = JSON.parse(await decrypt(value)) as OrganizationSessionData;
    if (Date.now() > session.expiresAt * 1000) {
      await clearOrganizationSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function getOrganizationAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(AUTH_ORG_TOKEN_COOKIE)?.value;

  if (tokenCookie) {
    try {
      const token = await decrypt(tokenCookie);
      if (isJwtLike(token)) return token;
    } catch {
      // Fall through to the session cookie.
    }
  }

  const session = await getOrganizationSession();
  return isJwtLike(session?.idToken) ? session.idToken : null;
}

export async function clearOrganizationSession() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_ORG_SESSION_COOKIE);
  cookieStore.delete(AUTH_ORG_TOKEN_COOKIE);
}
