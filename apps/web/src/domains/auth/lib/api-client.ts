/**
 * Authenticated API Client — Web Client (Server-Side)
 *
 * Fetch wrapper for NestJS resource server calls from Server Components
 * and Route Handlers. Attaches Bearer auth automatically.
 */
import { getAccessToken } from "./session";

const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://api:3333/api";

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API_URL}${path}`, { ...options, headers });
}
