import { getHydraAdminUrl } from "./config";

async function parseJson(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

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
