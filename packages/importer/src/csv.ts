import { parse } from "csv-parse/sync";

export function parseCsvHeaders(input: string): string[] {
  const rows = parse(input, {
    bom: true,
    skip_empty_lines: true,
    to_line: 1,
  }) as string[][];

  if (rows.length === 0) return [];
  return rows[0]!.map((header) => header.trim());
}

export function parseCsvRows(input: string): Array<Record<string, string>> {
  return parse(input, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;
}

export function compactString(value: string | undefined | null): string {
  if (!value) return "";
  return value.trim();
}

export function optionalString(value: string | undefined | null): string | null {
  const next = compactString(value);
  return next.length > 0 ? next : null;
}
