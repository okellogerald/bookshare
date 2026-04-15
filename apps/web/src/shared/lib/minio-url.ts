"use client";

const LOCALHOST = "localhost";
const LOOPBACK = "127.0.0.1";
const MINIO_API_PORT = "9002";

function shouldNormalizeLocalMinioUrl() {
  if (typeof window === "undefined") return false;

  const { hostname } = window.location;
  return hostname === LOCALHOST || hostname === LOOPBACK;
}

export function normalizeLocalMinioUrl<T extends string | null | undefined>(
  value: T
): T {
  if (!value || !shouldNormalizeLocalMinioUrl()) return value;

  try {
    const parsed = new URL(value);

    if (parsed.hostname !== LOCALHOST || parsed.port !== MINIO_API_PORT) {
      return value;
    }

    parsed.hostname = LOOPBACK;
    return parsed.toString() as T;
  } catch {
    return value;
  }
}

export function normalizeLocalMinioUrls<T>(value: T): T {
  if (!shouldNormalizeLocalMinioUrl()) return value;

  if (typeof value === "string") {
    return normalizeLocalMinioUrl(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeLocalMinioUrls(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        normalizeLocalMinioUrls(item),
      ])
    ) as T;
  }

  return value;
}
