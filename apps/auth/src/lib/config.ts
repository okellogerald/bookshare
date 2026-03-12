function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getAuthPortalPublicUrl(): string {
  return process.env.AUTH_PORTAL_PUBLIC_URL || "http://localhost:3337";
}

export function getBookshareAppPublicUrl(): string {
  return process.env.BOOKSHARE_APP_PUBLIC_URL || "http://localhost:3334";
}

export function getKratosBrowserUrl(): string {
  return process.env.KRATOS_BROWSER_URL || "http://localhost:4433";
}

export function getKratosInternalPublicUrl(): string {
  return process.env.KRATOS_PUBLIC_INTERNAL_URL || "http://kratos:4433";
}

export function getHydraAdminUrl(): string {
  return process.env.HYDRA_ADMIN_URL || "http://hydra:4445";
}

export function getHydraRememberFor(): number {
  return parseInteger(process.env.HYDRA_REMEMBER_FOR, 3600);
}
