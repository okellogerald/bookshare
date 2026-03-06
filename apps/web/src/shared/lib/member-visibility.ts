const defaultHiddenUsernames = ["admin", "admin_booktrack_local"];

function normalizeUsername(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

const hiddenUsernames = (() => {
  const configured = (process.env.NEXT_PUBLIC_HIDDEN_USERNAMES ?? "")
    .split(",")
    .map((value) => normalizeUsername(value))
    .filter((value): value is string => !!value);

  return new Set([...defaultHiddenUsernames, ...configured]);
})();

export function isHiddenCommunityUsername(
  username: string | null | undefined
): boolean {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;
  return hiddenUsernames.has(normalized);
}

export function isVisibleCommunityUsername(
  username: string | null | undefined
): boolean {
  return !isHiddenCommunityUsername(username);
}

