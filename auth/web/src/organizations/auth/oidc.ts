import { createOIDCEnvHelpers } from "@bookshare/shared";
import * as client from "openid-client";

const envHelpers = createOIDCEnvHelpers({
  defaultAppUrl: "http://localhost:3337",
  runtimeName: "auth web organization console",
});

let config: client.Configuration | null = null;

export async function getOIDCConfig(): Promise<client.Configuration> {
  if (config) return config;

  const environment = envHelpers.getOIDCEnvironment();
  config = new client.Configuration(
    environment.serverMetadata,
    environment.clientId
  );

  if (environment.customFetchHost) {
    config[client.customFetch] = (input, init) => {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      headers.set("host", environment.customFetchHost!);
      return fetch(input as any, { ...(init as any), headers } as any);
    };
  }

  if (environment.allowInsecureRequests) {
    client.allowInsecureRequests(config);
  }

  return config;
}

export const { getRedirectUri, getPostLogoutRedirectUri } = envHelpers;
