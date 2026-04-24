/**
 * Frontend-callable read-resource names.
 *
 * These names are the shared contract between:
 * - the Next.js BFF routes (`/api/backend/:resource`)
 * - the Nest read gateway (`/api/read/:audience/:resource`, with a legacy
 *   fallback at `/api/read/:resource`)
 *
 * A name being listed here does not automatically make it safe to expose.
 * The actual policy, audience, and rationale live in
 * `apps/api/src/modules/read-gateway/read-resources.ts`.
 */
export const READ_GATEWAY_RESOURCE_NAMES = [
  "authors",
  "book_quotes_with_book",
  "books",
  "books_with_authors",
  "books_with_categories",
  "browse_listings",
  "browse_wishes",
  "categories",
  "copies",
  "editions",
  "member_profiles",
  "wishes",
] as const;

export type ReadGatewayResourceName =
  (typeof READ_GATEWAY_RESOURCE_NAMES)[number];

const READ_GATEWAY_RESOURCE_NAME_SET = new Set<string>(
  READ_GATEWAY_RESOURCE_NAMES
);

export function isReadGatewayResourceName(
  value: string
): value is ReadGatewayResourceName {
  return READ_GATEWAY_RESOURCE_NAME_SET.has(value);
}
