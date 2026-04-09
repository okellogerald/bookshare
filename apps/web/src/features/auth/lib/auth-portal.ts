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

export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value) return "/browse";
  if (!value.startsWith("/")) return "/browse";
  if (value.startsWith("//")) return "/browse";
  if (value.startsWith("/api/auth")) return "/browse";
  return value;
}

export function buildAppLoginUrl(returnTo: string): string {
  const url = new URL("/api/auth/login", getAppBaseUrl());
  url.searchParams.set("returnTo", sanitizeReturnTo(returnTo));
  return url.toString();
}

export function buildAuthPortalVerificationUrl(): string {
  const url = new URL("/verification", getAuthPortalBaseUrl());
  return url.toString();
}

export function buildAuthPortalSettingsUrl(
  section?: "profile" | "password"
): string {
  const url = new URL("/settings", getAuthPortalBaseUrl());
  if (section) {
    url.searchParams.set("section", section);
  }
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
