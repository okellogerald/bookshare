export function parseFlagArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = value;
    i += 1;
  }

  return out;
}

export function requireFlag(
  flags: Record<string, string>,
  key: string
): string {
  const value = flags[key];
  if (!value) {
    throw new Error(`Missing required flag --${key}`);
  }
  return value;
}
