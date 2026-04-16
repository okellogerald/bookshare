/**
 * Environment Configuration — Auth-Portal
 *
 * Centralized access to all environment-dependent URLs and settings.
 * Each getter has a sensible default for local Docker Compose development.
 *
 * URL naming convention:
 * - "Public" URLs: reachable by the browser (localhost:port)
 * - "Internal" URLs: reachable only within Docker network (service:port)
 *
 * The Auth-Portal needs both because:
 * - Redirects sent to the browser must use public URLs
 * - Server-to-server calls (Kratos, Hydra admin) must use internal URLs
 */

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Auth-Portal's own public URL — used for redirect targets and error pages. */
export function getAuthPortalPublicUrl(): string {
  return process.env.AUTH_PORTAL_PUBLIC_URL || "http://localhost:3337";
}

/** Web app's public URL — used as the final redirect after policy checks pass. */
export function getBookshareAppPublicUrl(): string {
  return process.env.BOOKSHARE_APP_PUBLIC_URL || "http://localhost:3334";
}

/** Kratos public URL reachable by the browser (for form action URLs). */
export function getKratosBrowserUrl(): string {
  return process.env.KRATOS_BROWSER_URL || "http://localhost:4433";
}

/** Kratos internal URL for server-to-server calls (session checks, flow init). */
export function getKratosInternalPublicUrl(): string {
  return process.env.KRATOS_PUBLIC_INTERNAL_URL || "http://kratos:4433";
}

/** Hydra admin API URL for server-to-server challenge management (port 4445). */
export function getHydraAdminUrl(): string {
  return process.env.HYDRA_ADMIN_URL || "http://hydra:4445";
}

/**
 * How long (seconds) Hydra should cache login/consent decisions.
 * Defaults to 3600 (1 hour). During this window, subsequent login attempts
 * for the same user skip re-authentication (loginRequest.skip=true).
 */
export function getHydraRememberFor(): number {
  return parseInteger(process.env.HYDRA_REMEMBER_FOR, 3600);
}
