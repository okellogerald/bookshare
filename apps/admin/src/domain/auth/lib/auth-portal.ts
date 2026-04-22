import { sanitizeRelativeReturnTo } from "@bookshare/shared";

const DEFAULT_AUTH_PORTAL_URL = "http://localhost:3337";
const DEFAULT_APP_URL = "http://localhost:3338";

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

export function sanitizeReturnTo(value: string | null | undefined): string {
  return sanitizeRelativeReturnTo(value, "/catalog");
}

export function buildAuthPortalVerificationUrl(): string {
  return new URL("/verification", getAuthPortalBaseUrl()).toString();
}

export function buildAuthPortalResolveUrl(returnTo: string): string {
  const url = new URL("/oauth/login", getAuthPortalBaseUrl());
  url.searchParams.set("source", "admin");
  url.searchParams.set("returnTo", sanitizeReturnTo(returnTo));
  return url.toString();
}

export function buildAuthPortalLogoutUrl(): string {
  const url = new URL("/logout", getAuthPortalBaseUrl());
  url.searchParams.set("return_to", getAppBaseUrl());
  return url.toString();
}

export function buildAppPostLogoutUrl(): string {
  return new URL("/api/auth/post-logout", getAppBaseUrl()).toString();
}
