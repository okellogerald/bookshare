import { normalizeLocalMinioUrls } from "@/shared/lib/minio-url";

export async function nestjsFetch<T>(
  path: string,
  method: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`/api/nestjs/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) {
        message = parsed.message.join(". ");
      } else if (typeof parsed.message === "string") {
        message = parsed.message;
      }
    } catch {
      // keep raw text when backend did not return JSON
    }
    throw new Error(`API error (${res.status}): ${message}`);
  }

  if (res.status === 204) return undefined as T;
  return normalizeLocalMinioUrls(await res.json()) as T;
}
