/**
 * Auth-Portal URL Helpers — Web Client
 *
 * Builds URLs that point to the Auth-Portal app for operations that live
 * outside the Web client's domain: email verification, profile settings,
 * and Kratos session cleanup (the final phase of logout).
 *
 * The Auth-Portal is the bridge between OAuth2 (Hydra) and identity (Kratos).
 * These URLs are used for redirects during login validation failures and
 * during the multi-phase logout process.
 *
 * @see `auth/web/` — the Auth-Portal app itself
 * @see `/api/auth/post-logout` — uses buildAuthPortalLogoutUrl()
 * @see `/api/auth/callback` — uses returnTo directly after a successful login
 */
import { sanitizeRelativeReturnTo } from "@bookshare/shared";

const DEFAULT_AUTH_PORTAL_URL = "http://localhost:3337";
const DEFAULT_APP_URL = "http://localhost:3334";

function getAuthPortalBaseUrl(): string {
  return (
    process.env.AUTH_PORTAL_URL ||
    process.env.NEXT_PUBLIC_AUTH_PORTAL_URL ||
    DEFAULT_AUTH_PORTAL_URL
  );
}

function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL;
}

/** Sanitize returnTo to a relative path, preventing open redirects. */
export function sanitizeReturnTo(value: string | null | undefined): string {
  return sanitizeRelativeReturnTo(value, "/browse");
}

/** Full login URL for the Web app — used by Auth-Portal to redirect back. */
export function buildAppLoginUrl(returnTo: string): string {
  const url = new URL("/api/auth/login", getAppBaseUrl());
  url.searchParams.set("returnTo", sanitizeReturnTo(returnTo));
  return url.toString();
}

/** Auth-Portal email verification page — redirected here when email is unverified. */
export function buildAuthPortalVerificationUrl(returnTo?: string): string {
  const url = new URL("/verification", getAuthPortalBaseUrl());
  if (returnTo) {
    url.searchParams.set("return_to", buildAppLoginUrl(returnTo));
  }
  return url.toString();
}

/** Auth-Portal settings page — redirected here when profile is incomplete. */
export function buildAuthPortalSettingsUrl(
  section?: "profile" | "password"
): string {
  const url = new URL("/settings", getAuthPortalBaseUrl());
  if (section) {
    url.searchParams.set("section", section);
  }
  return url.toString();
}

/** Auth-Portal logout page — Phase 3 of logout: clears the Kratos session. */
export function buildAuthPortalLogoutUrl(): string {
  const url = new URL("/logout", getAuthPortalBaseUrl());
  url.searchParams.set("return_to", getAppBaseUrl());
  return url.toString();
}

/**
 * Web app's post-logout redirect URI — registered with Hydra.
 * Hydra redirects here after invalidating the OAuth session (Phase 2).
 * The route at this URL then bounces to Auth-Portal for Kratos cleanup.
 */
export function buildAppPostLogoutUrl(): string {
  return new URL("/api/auth/post-logout", getAppBaseUrl()).toString();
}
