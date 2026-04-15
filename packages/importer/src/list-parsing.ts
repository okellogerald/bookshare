import { compactString } from "./csv";

export function parseDelimitedUniqueList(value: string | undefined): string[] {
  const next = compactString(value);
  if (!next) return [];

  const segments =
    next.includes(";")
      ? next.split(";")
      : next.includes("|")
        ? next.split("|")
        : next.split(",");

  const deduped = new Set<string>();
  for (const part of segments) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    deduped.add(trimmed);
  }

  return [...deduped];
}

export function parseThemaCodes(value: string | undefined): string[] {
  const raw = parseDelimitedUniqueList(value);
  const deduped = new Set<string>();

  for (const code of raw) {
    deduped.add(code.toUpperCase());
  }

  return [...deduped];
}
