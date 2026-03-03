import * as client from "openid-client";

let config: client.Configuration | null = null;

export async function getOIDCConfig(): Promise<client.Configuration> {
  if (config) return config;

  const publicIssuer = new URL(
    process.env.ZITADEL_ISSUER_URL ||
      process.env.NEXT_PUBLIC_ZITADEL_URL ||
      "http://localhost:8085"
  );
  const internalIssuer = new URL(
    process.env.ZITADEL_INTERNAL_URL || publicIssuer.href
  );
  const clientId = process.env.ZITADEL_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      "ZITADEL_CLIENT_ID is not configured. Set it in .env and restart the web container."
    );
  }

  const serverMetadata: client.ServerMetadata = {
    issuer: publicIssuer.origin,
    authorization_endpoint: new URL(
      "/oauth/v2/authorize",
      publicIssuer
    ).toString(),
    end_session_endpoint: new URL(
      "/oidc/v1/end_session",
      publicIssuer
    ).toString(),
    token_endpoint: new URL("/oauth/v2/token", internalIssuer).toString(),
    jwks_uri: new URL("/oauth/v2/keys", internalIssuer).toString(),
    userinfo_endpoint: new URL(
      "/oidc/v1/userinfo",
      internalIssuer
    ).toString(),
  };

  config = new client.Configuration(serverMetadata, clientId);

  // In Docker dev, internal calls go through host.docker.internal but Zitadel
  // instance resolution is based on the public host.
  if (internalIssuer.host !== publicIssuer.host) {
    config[client.customFetch] = (input, init) => {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      headers.set("host", publicIssuer.host);
      return fetch(input as any, { ...(init as any), headers } as any);
    };
  }

  // Local dev stack intentionally uses HTTP.
  if (process.env.NODE_ENV !== "production") {
    client.allowInsecureRequests(config);
  }

  return config;
}

export function getRedirectUri(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3334";
  return `${baseUrl}/api/auth/callback`;
}

export function getPostLogoutRedirectUri(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3334";
}
