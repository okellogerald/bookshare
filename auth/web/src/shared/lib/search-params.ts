export type AuthSearchParams = Record<string, string | string[] | undefined>;

export function getSingleParam(
  params: AuthSearchParams,
  key: string
): string | undefined {
  const value = params[key];
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}
