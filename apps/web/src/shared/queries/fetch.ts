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
    throw new Error(`API error (${res.status}): ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
