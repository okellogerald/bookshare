/**
 * Hydra Admin API Client
 *
 * Makes requests to Hydra's admin API (port 4445) for managing OAuth2
 * login, consent, and logout challenges. This is a server-to-server
 * connection — never exposed to the browser.
 *
 * All challenge lifecycle operations go through this client:
 * - GET challenges (fetch login/consent/logout request details)
 * - PUT accept/reject (tell Hydra the decision)
 *
 * @see `config.ts` — getHydraAdminUrl() for the base URL
 */
import { getHydraAdminUrl } from "./config";

/** Safely parse a response body as JSON, returning null on empty or invalid. */
async function parseJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Make an authenticated request to Hydra's admin API.
 * Throws on non-2xx responses with the Hydra error message.
 * Uses `cache: "no-store"` to prevent Next.js from caching challenge state.
 */
export async function hydraAdminRequest<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${getHydraAdminUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const body = await parseJson(response);

  if (!response.ok) {
    const message = body?.error_description || body?.error || response.statusText;
    throw new Error(`Hydra API error (${response.status}): ${message}`);
  }

  return body as T;
}
