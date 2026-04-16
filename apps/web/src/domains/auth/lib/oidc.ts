/**
 * OIDC Client Configuration — Web Client
 *
 * Configures the `openid-client` library to talk to Hydra. The configuration
 * is created lazily and cached for the process lifetime.
 *
 * Key detail: in Docker environments, the Next.js server reaches Hydra via
 * the internal URL (e.g., http://hydra:4444), but the JWT issuer claim uses
 * the public URL (e.g., http://localhost:4444). The `customFetchHost` option
 * handles this mismatch by setting the Host header on outbound requests so
 * Hydra recognizes them as belonging to the correct issuer.
 *
 * @see `@bookshare/shared` createOIDCEnvHelpers — shared OIDC env resolution
 */
import { createOIDCEnvHelpers } from "@bookshare/shared";
import * as client from "openid-client";

const envHelpers = createOIDCEnvHelpers({
  defaultAppUrl: "http://localhost:3334",
  runtimeName: "web container",
});

/** Cached OIDC configuration — initialized once per process. */
let config: client.Configuration | null = null;

/**
 * Get the openid-client Configuration for Hydra. Resolves OIDC metadata
 * (endpoints, JWKS, issuer) from environment variables and configures
 * internal-to-public URL mapping for Docker networking.
 */
async function getOIDCConfig(): Promise<client.Configuration> {
  if (config) return config;

  const environment = envHelpers.getOIDCEnvironment();
  config = new client.Configuration(
    environment.serverMetadata,
    environment.clientId
  );

  // In Docker, the server reaches Hydra at http://hydra:4444 but the JWT
  // issuer is http://localhost:4444. Override the Host header so Hydra
  // accepts requests as belonging to the public issuer.
  if (environment.customFetchHost) {
    config[client.customFetch] = (input, init) => {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      headers.set("host", environment.customFetchHost!);
      return fetch(input as any, { ...(init as any), headers } as any);
    };
  }

  // Allow HTTP in development (Hydra typically runs without TLS locally).
  if (environment.allowInsecureRequests) {
    client.allowInsecureRequests(config);
  }

  return config;
}

const { getRedirectUri, getPostLogoutRedirectUri } = envHelpers;

export {
  getOIDCConfig,
  getRedirectUri,
  getPostLogoutRedirectUri,
};
