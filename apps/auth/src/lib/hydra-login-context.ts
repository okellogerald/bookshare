/**
 * Hydra Login Challenge Persistence — Auth-Portal
 *
 * When Hydra redirects to the Auth-Portal with a `login_challenge`, the user
 * may need to navigate through several Kratos pages (login form, verification,
 * profile settings) before returning to the challenge handler. The challenge
 * ID would be lost during these navigations because Kratos's return_to URL
 * cannot carry arbitrary parameters.
 *
 * This module solves that by persisting the challenge as an httpOnly cookie
 * (15-minute TTL). The login challenge handler checks this cookie when no
 * `login_challenge` query parameter is present, allowing the flow to resume
 * after Kratos operations complete.
 *
 * @see `/oauth/login/route.ts` — reads and writes the challenge cookie
 */
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const HYDRA_LOGIN_CHALLENGE_COOKIE = "bookshare_hydra_login_challenge";
const HYDRA_LOGIN_CHALLENGE_MAX_AGE_SECONDS = 15 * 60;

const HYDRA_LOGIN_CHALLENGE_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: HYDRA_LOGIN_CHALLENGE_MAX_AGE_SECONDS,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Persists the active Hydra login challenge inside the auth box so internal
 * auth pages do not need to thread the challenge through generic return URLs.
 */
export function persistHydraLoginChallenge(
  response: NextResponse,
  challenge: string
): void {
  response.cookies.set(
    HYDRA_LOGIN_CHALLENGE_COOKIE,
    challenge,
    HYDRA_LOGIN_CHALLENGE_COOKIE_OPTIONS
  );
}

/**
 * Clears the stored Hydra login challenge once auth has either completed the
 * transaction or abandoned it due to an unrecoverable error.
 */
export function clearHydraLoginChallenge(response: NextResponse): void {
  response.cookies.delete(HYDRA_LOGIN_CHALLENGE_COOKIE);
}

/**
 * Reads the Hydra login challenge currently owned by the auth box.
 */
export async function getHydraLoginChallenge(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(HYDRA_LOGIN_CHALLENGE_COOKIE)?.value?.trim();
  return value ? value : null;
}
