import * as client from "openid-client";

let config: client.Configuration | null = null;

function resolveUrl(
  value: string | undefined,
  base: URL,
  defaultPath: string
): string {
  if (!value || value.trim().length === 0) {
    return new URL(defaultPath, base).toString();
  }
  return new URL(value, base).toString();
}

export async function getOIDCConfig(): Promise<client.Configuration> {
  if (config) return config;

  const publicIssuer = new URL(
    process.env.OIDC_ISSUER_URL ||
      process.env.NEXT_PUBLIC_OIDC_ISSUER_URL ||
      "http://localhost:4444"
  );
  const internalIssuer = new URL(process.env.OIDC_INTERNAL_URL || publicIssuer.href);
  const clientId = process.env.OIDC_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      "OIDC_CLIENT_ID is not configured. Set it in .env and restart the admin container."
    );
  }

  const serverMetadata: client.ServerMetadata = {
    issuer: publicIssuer.origin,
    authorization_endpoint: resolveUrl(
      process.env.OIDC_AUTHORIZATION_ENDPOINT,
      publicIssuer,
      "/oauth2/auth"
    ),
    end_session_endpoint: resolveUrl(
      process.env.OIDC_END_SESSION_ENDPOINT,
      publicIssuer,
      "/oauth2/sessions/logout"
    ),
    token_endpoint: resolveUrl(
      process.env.OIDC_TOKEN_ENDPOINT,
      internalIssuer,
      "/oauth2/token"
    ),
    jwks_uri: resolveUrl(
      process.env.OIDC_JWKS_URI,
      internalIssuer,
      "/.well-known/jwks.json"
    ),
    userinfo_endpoint: resolveUrl(
      process.env.OIDC_USERINFO_ENDPOINT,
      internalIssuer,
      "/userinfo"
    ),
  };

  config = new client.Configuration(serverMetadata, clientId);

  if (internalIssuer.host !== publicIssuer.host) {
    config[client.customFetch] = (input, init) => {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      headers.set("host", publicIssuer.host);
      return fetch(input as any, { ...(init as any), headers } as any);
    };
  }

  if (process.env.NODE_ENV !== "production") {
    client.allowInsecureRequests(config);
  }

  return config;
}

export function getRedirectUri(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3338";
  return `${baseUrl}/api/auth/callback`;
}

export function getPostLogoutRedirectUri(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3338";
}
