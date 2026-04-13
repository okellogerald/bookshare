/**
 * Authenticated API Client — Web Client (Server-Side)
 *
 * Provides a `fetch`-like interface for calling the NestJS resource server
 * from Next.js Server Components and Route Handlers. Automatically attaches
 * the correct authorization headers:
 *
 * - If the session contains a DPoP private key and the access token has a
 *   DPoP binding (cnf.jkt claim), creates a fresh DPoP proof for each
 *   request: `Authorization: DPoP <token>` + `DPoP: <proof>`.
 *
 * - Otherwise, falls back to plain Bearer auth: `Authorization: Bearer <token>`.
 *
 * All calls go to the internal API URL (server-to-server within Docker)
 * to avoid going through the public network.
 *
 * @see `session.ts` — getAccessToken() and getSession()
 * @see `dpop.ts` — createDPoPProof() and tokenHasDpopBinding()
 */
import { getAccessToken, getSession } from "./session";
import { createDPoPProof, tokenHasDpopBinding } from "./dpop";

/** Internal URL for the NestJS resource server (server-to-server). */
const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://api:3333/api";

/**
 * Make an authenticated request to the NestJS resource server.
 * Reads the session to determine auth method (DPoP vs Bearer).
 * Use in Server Components and Route Handlers — not in client components.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  const session = await getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    const method = (options.method ?? "GET").toUpperCase();
    const fullUrl = `${API_URL}${path}`;

    if (session?.dpopJwk && tokenHasDpopBinding(token)) {
      const dpopProof = await createDPoPProof(session.dpopJwk, method, fullUrl, token);
      headers["Authorization"] = `DPoP ${token}`;
      headers["DPoP"] = dpopProof;
    } else {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
}
