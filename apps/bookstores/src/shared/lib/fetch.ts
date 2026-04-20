import { normalizeLocalMinioUrls } from "@/shared/lib/minio-url";

function extractErrorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    if (
      Array.isArray(message) &&
      typeof message[0] === "string" &&
      message[0].trim().length > 0
    ) {
      return message[0];
    }
  }

  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  return `API error (${status})`;
}

export async function nestjsFetch<T>(
  path: string,
  method: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }

    throw new Error(extractErrorMessage(payload, response.status));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return normalizeLocalMinioUrls((await response.json()) as T);
}
