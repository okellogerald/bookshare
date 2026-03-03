/**
 * PostgREST client for read operations.
 *
 * Two modes:
 * - postgrestAuth: Server-side authenticated reads (attaches JWT from session)
 * - postgrestPublic: Server-side public reads (no JWT, uses PostgREST anon role)
 *
 * All GET/read requests go through PostgREST (not NestJS).
 * PostgREST auto-generates a REST API from the PostgreSQL schema.
 * The JWT is forwarded to Postgres which enforces RLS policies.
 */

import { getAccessToken } from "@/features/auth/lib/session";

const POSTGREST_URL =
  process.env.POSTGREST_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_POSTGREST_URL ||
  "http://postgrest:3000";

// ─── Options & Response Types ────────────────────────────────

export interface PostgRESTOptions {
  /** Column selection (PostgREST select parameter) */
  select?: string;
  /** Filters as key-value pairs: { column: "eq.value" } */
  filters?: Record<string, string>;
  /** Ordering: "column.asc" or "column.desc" */
  order?: string;
  /** Pagination: number of rows */
  limit?: number;
  /** Pagination: offset */
  offset?: number;
  /** If true, returns a single object instead of an array */
  single?: boolean;
  /** If true, also returns total count in response */
  count?: boolean;
}

export interface PostgRESTResponse<T> {
  data: T;
  count?: number;
}

// ─── Error Class ─────────────────────────────────────────────

export class PostgRESTError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public table: string,
  ) {
    super(`PostgREST error on "${table}" (${status}): ${detail}`);
    this.name = "PostgRESTError";
  }
}

// ─── Internal Fetch ──────────────────────────────────────────

async function postgrestFetch<T>(
  table: string,
  options: PostgRESTOptions = {},
  token?: string | null,
): Promise<PostgRESTResponse<T>> {
  const url = new URL(`/${table}`, POSTGREST_URL);

  // Select
  if (options.select) {
    url.searchParams.set("select", options.select);
  }

  // Filters
  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      url.searchParams.set(key, value);
    }
  }

  // Ordering
  if (options.order) {
    url.searchParams.set("order", options.order);
  }

  // Pagination
  if (options.limit !== undefined) {
    url.searchParams.set("limit", String(options.limit));
  }
  if (options.offset !== undefined) {
    url.searchParams.set("offset", String(options.offset));
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Request a single object
  if (options.single) {
    headers["Accept"] = "application/vnd.pgrst.object+json";
  }

  // Request count
  if (options.count) {
    headers["Prefer"] = "count=exact";
  }

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    const error = await response.text();
    throw new PostgRESTError(response.status, error, table);
  }

  const data = (await response.json()) as T;

  // Extract count from Content-Range header
  let count: number | undefined;
  if (options.count) {
    const contentRange = response.headers.get("Content-Range");
    if (contentRange) {
      const total = contentRange.split("/")[1];
      if (total && total !== "*") {
        count = parseInt(total, 10);
      }
    }
  }

  return { data, count };
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Server-side authenticated PostgREST client.
 * Attaches the JWT from the current session for RLS-protected queries.
 * Use in Server Components and Route Handlers for tenant-scoped reads.
 *
 * @example
 * // Get all copies for the authenticated user's organization
 * const { data: copies } = await postgrestAuth<PgCopyDetail[]>("copies", {
 *   select: "*, edition:editions(*, book:books(*)), organization:organizations(*)",
 *   order: "created_at.desc",
 * });
 *
 * @example
 * // Get a single copy by ID
 * const { data: copy } = await postgrestAuth<PgCopyDetail>("copies", {
 *   filters: { id: "eq.some-uuid" },
 *   select: "*, edition:editions(*, book:books(*)), organization:organizations(*)",
 *   single: true,
 * });
 */
export async function postgrestAuth<T>(
  table: string,
  options: PostgRESTOptions = {},
): Promise<PostgRESTResponse<T>> {
  const token = await getAccessToken();
  return postgrestFetch<T>(table, options, token);
}

/**
 * Server-side public PostgREST client.
 * No JWT attached — uses PostgREST's anonymous role.
 * Use for public data like the book catalog, store listings, etc.
 *
 * @example
 * // Browse public listings (no auth needed)
 * const { data: listings } = await postgrestPublic<PgPublicListing[]>("public_listings", {
 *   order: "created_at.desc",
 *   limit: 20,
 * });
 *
 * @example
 * // Browse book catalog
 * const { data: books } = await postgrestPublic<PgBookWithAuthors[]>("books", {
 *   select: "*, book_authors(author:authors(*))",
 *   order: "title.asc",
 * });
 */
export async function postgrestPublic<T>(
  table: string,
  options: PostgRESTOptions = {},
): Promise<PostgRESTResponse<T>> {
  return postgrestFetch<T>(table, options, null);
}
