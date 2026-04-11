import { createOIDCEnvHelpers } from "@bookshare/shared";
import * as client from "openid-client";

const envHelpers = createOIDCEnvHelpers({
  defaultAppUrl: "http://localhost:3338",
  runtimeName: "admin container",
});

let config: client.Configuration | null = null;

async function getOIDCConfig(): Promise<client.Configuration> {
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

const { getRedirectUri, getPostLogoutRedirectUri } = envHelpers;

export {
  getOIDCConfig,
  getRedirectUri,
  getPostLogoutRedirectUri,
};
