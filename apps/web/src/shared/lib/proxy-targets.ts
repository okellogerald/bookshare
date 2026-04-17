function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function buildProxyBaseUrlCandidates(
  ...values: Array<string | undefined>
) {
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;

    const normalized = normalizeBaseUrl(trimmed);
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    candidates.push(normalized);
  }

  return candidates;
}

export function buildProxyRequestUrl(baseUrl: string, path: string, search = "") {
  const sanitizedPath = path.replace(/^\/+/, "");
  const url = `${normalizeBaseUrl(baseUrl)}/${sanitizedPath}`;
  return search ? `${url}?${search}` : url;
}
