import { getAccessToken, getSession } from "./session";
import { createDPoPProof, tokenHasDpopBinding } from "./dpop";

const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://api:3333/api";

/**
 * Server-side API client that automatically attaches the auth token.
 * Uses DPoP proof headers when a DPoP key is available in the session.
 * Use in Server Components and Route Handlers.
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
