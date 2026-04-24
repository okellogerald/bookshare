import type { ReadGatewayResourceName } from "@bookshare/shared";

/**
 * Shape declarations for each read-gateway resource.
 *
 * Why this exists:
 * - The gateway is a passthrough to PostgREST, so responses are the raw row
 *   shapes of the underlying table or view. Clients otherwise have to read
 *   SQL migrations to know what columns come back.
 * - These descriptors document the exact JSON keys and types clients should
 *   expect from `GET /read/:resource`, so Swagger, TypeScript consumers, and
 *   code reviewers can reason about the payload without leaving this module.
 *
 * What this is NOT:
 * - Runtime validation. The gateway trusts PostgREST + the SQL schema; this
 *   file records the contract rather than enforcing it.
 * - A mirror of the domain types in `packages/shared`. Those are camelCase
 *   app-level models; these are snake_case PostgREST row shapes.
 *
 * Keep in sync with `packages/db/src/schema/**` and
 * `packages/db/src/migrations/0002_postgrest_read_api.sql`.
 */

export type ReadColumnType =
  | "uuid"
  | "text"
  | "varchar"
  | "int"
  | "boolean"
  | "timestamptz"
  | "enum"
  | "json";

export interface ReadResourceColumn {
  name: string;
  type: ReadColumnType;
  nullable?: boolean;
  /** Literal string values for enum columns (status, format, condition, …). */
  enumValues?: readonly string[];
  /** Optional prose — only include when the column is not self-explanatory. */
  description?: string;
}

export interface ReadResourceShape {
  /** Short sentence describing what a single row represents. */
  description: string;
  /**
   * Whether the resource emits an array of rows (the usual case for PostgREST
   * list endpoints) or a single object. All current resources are lists.
   */
  rowKind: "list";
  /** Column descriptors in a stable order matching the PostgREST payload. */
  columns: ReadonlyArray<ReadResourceColumn>;
}

// ---------------------------------------------------------------------------
// Shared column fragments
// ---------------------------------------------------------------------------
// Several resources share the same timestamp or id columns. Defining them
// once keeps the per-resource shape declarations focused on what is actually
// distinctive about that resource.

const ID_UUID: ReadResourceColumn = { name: "id", type: "uuid" };
const CREATED_AT: ReadResourceColumn = { name: "created_at", type: "timestamptz" };
const UPDATED_AT: ReadResourceColumn = { name: "updated_at", type: "timestamptz" };

const COPY_STATUS_VALUES = ["available", "shelved", "lent", "gone"] as const;
const COPY_CONDITION_VALUES = ["new", "like_new", "good", "fair", "poor"] as const;
const COPY_SHARE_TYPE_VALUES = ["lend", "sell", "give_away"] as const;
const EDITION_FORMAT_VALUES = ["hardcover", "paperback", "mass_market"] as const;
const WISH_STATUS_VALUES = ["active", "fulfilled", "cancelled"] as const;
const WISH_CLOSURE_REASON_VALUES = [
  "removed_by_wisher",
  "matched_member_lent",
  "matched_member_gone",
  "archived_by_admin",
] as const;

// Embedded JSON arrays emitted by the convenience views. These are shaped by
// the SQL (`json_agg(json_build_object(...))`) rather than a base table, so
// we describe them inline on each view rather than through FK embedding.
const AUTHORS_EMBED: ReadResourceColumn = {
  name: "authors",
  type: "json",
  description: "Array of { id: uuid, name: string } objects derived from book_authors.",
};

// ---------------------------------------------------------------------------
// Per-resource shape declarations
// ---------------------------------------------------------------------------

export const READ_RESOURCE_SHAPES: Record<
  ReadGatewayResourceName,
  ReadResourceShape
> = {
  authors: {
    description: "Catalog author records used by book-entry and search flows.",
    rowKind: "list",
    columns: [
      ID_UUID,
      { name: "name", type: "varchar" },
      CREATED_AT,
      UPDATED_AT,
    ],
  },

  book_quotes_with_book: {
    description:
      "Book quotes joined through editions so each row carries both edition_id and book_id for filtering.",
    rowKind: "list",
    columns: [
      ID_UUID,
      { name: "text", type: "text" },
      { name: "chapter", type: "varchar", nullable: true },
      {
        name: "added_by",
        type: "varchar",
        description: "Kratos identity id of the contributor.",
      },
      CREATED_AT,
      { name: "edition_id", type: "uuid" },
      { name: "book_id", type: "uuid" },
    ],
  },

  books: {
    description: "Raw catalog book rows (admin-only).",
    rowKind: "list",
    columns: [
      ID_UUID,
      { name: "title", type: "varchar" },
      { name: "subtitle", type: "varchar", nullable: true },
      {
        name: "language",
        type: "varchar",
        description: "BCP-47-style short code (e.g. 'en', 'fr').",
      },
      CREATED_AT,
      UPDATED_AT,
    ],
  },

  books_with_authors: {
    description:
      "Books with their authors embedded as a JSON array — primary public book read model.",
    rowKind: "list",
    columns: [
      ID_UUID,
      { name: "title", type: "varchar" },
      { name: "subtitle", type: "varchar", nullable: true },
      { name: "language", type: "varchar" },
      CREATED_AT,
      UPDATED_AT,
      AUTHORS_EMBED,
    ],
  },

  books_with_categories: {
    description:
      "Books with their categories embedded as a JSON array — powers category filters and book-detail metadata.",
    rowKind: "list",
    columns: [
      ID_UUID,
      { name: "title", type: "varchar" },
      { name: "subtitle", type: "varchar", nullable: true },
      { name: "language", type: "varchar" },
      CREATED_AT,
      UPDATED_AT,
      {
        name: "categories",
        type: "json",
        description:
          "Array of { thema_code: string, name: string } objects derived from book_categories.",
      },
    ],
  },

  browse_listings: {
    description:
      "Denormalized, cross-user view of community-listed copies with owner, borrower, edition, and book info.",
    rowKind: "list",
    columns: [
      { name: "id", type: "uuid", description: "Copy id." },
      { name: "user_id", type: "varchar", description: "Owner identity id." },
      {
        name: "borrower_user_id",
        type: "varchar",
        nullable: true,
        description: "Identity id of the current borrower when status = 'lent'.",
      },
      { name: "edition_id", type: "uuid" },
      {
        name: "condition",
        type: "enum",
        enumValues: COPY_CONDITION_VALUES,
      },
      {
        name: "status",
        type: "enum",
        enumValues: ["available", "lent"],
        description: "Filtered subset of the copies.status enum surfaced in browse.",
      },
      {
        name: "share_type",
        type: "enum",
        enumValues: COPY_SHARE_TYPE_VALUES,
        nullable: true,
      },
      { name: "contact_note", type: "text", nullable: true },
      { name: "last_confirmed_at", type: "timestamptz", nullable: true },
      CREATED_AT,
      UPDATED_AT,
      { name: "isbn", type: "varchar", nullable: true },
      { name: "format", type: "enum", enumValues: EDITION_FORMAT_VALUES },
      { name: "publisher", type: "varchar", nullable: true },
      { name: "published_year", type: "int", nullable: true },
      { name: "page_count", type: "int", nullable: true },
      { name: "cover_image_url", type: "varchar", nullable: true },
      { name: "book_id", type: "uuid" },
      { name: "book_title", type: "varchar" },
      { name: "book_subtitle", type: "varchar", nullable: true },
      { name: "edition_description", type: "text", nullable: true },
      { name: "book_language", type: "varchar" },
      { name: "owner_first_name", type: "varchar", nullable: true },
      { name: "owner_last_name", type: "varchar", nullable: true },
      { name: "borrower_first_name", type: "varchar", nullable: true },
      { name: "borrower_last_name", type: "varchar", nullable: true },
      {
        name: "primary_image_url",
        type: "varchar",
        nullable: true,
        description: "First copy image by sort_order, if any.",
      },
      AUTHORS_EMBED,
    ],
  },

  browse_wishes: {
    description:
      "Grouped-by-book view of active community wishes, with representative edition and the list of wishers.",
    rowKind: "list",
    columns: [
      { name: "book_id", type: "uuid" },
      {
        name: "edition_id",
        type: "uuid",
        nullable: true,
        description: "Always null in this view — wishes are grouped at the book level.",
      },
      { name: "wish_count", type: "int" },
      { name: "book_title", type: "varchar" },
      { name: "book_subtitle", type: "varchar", nullable: true },
      { name: "edition_description", type: "text", nullable: true },
      { name: "book_language", type: "varchar" },
      { name: "edition_isbn", type: "varchar", nullable: true },
      {
        name: "edition_format",
        type: "enum",
        enumValues: EDITION_FORMAT_VALUES,
        nullable: true,
      },
      { name: "edition_cover_image_url", type: "varchar", nullable: true },
      {
        name: "wishers",
        type: "json",
        description:
          "Array of wisher objects: { user_id, first_name, last_name, location, contact_notes, avatar_url, notes, created_at, last_confirmed_at }.",
      },
      AUTHORS_EMBED,
    ],
  },

  categories: {
    description: "Thema category entries for filters and catalog forms.",
    rowKind: "list",
    columns: [
      {
        name: "thema_code",
        type: "varchar",
        description: "Primary key — Thema subject code (e.g. 'FBA').",
      },
      { name: "name", type: "varchar" },
      CREATED_AT,
    ],
  },

  copies: {
    description:
      "Member-owned copy inventory. Scoped to the current user unless the caller is platform staff.",
    rowKind: "list",
    columns: [
      ID_UUID,
      { name: "user_id", type: "varchar" },
      { name: "edition_id", type: "uuid" },
      { name: "condition", type: "enum", enumValues: COPY_CONDITION_VALUES },
      { name: "status", type: "enum", enumValues: COPY_STATUS_VALUES },
      { name: "notes", type: "text", nullable: true },
      {
        name: "share_type",
        type: "enum",
        enumValues: COPY_SHARE_TYPE_VALUES,
        nullable: true,
      },
      { name: "contact_note", type: "text", nullable: true },
      { name: "last_confirmed_at", type: "timestamptz", nullable: true },
      CREATED_AT,
      UPDATED_AT,
    ],
  },

  editions: {
    description: "Edition metadata (ISBN, publisher, cover, …) attached to a book.",
    rowKind: "list",
    columns: [
      ID_UUID,
      { name: "book_id", type: "uuid" },
      { name: "isbn", type: "varchar", nullable: true },
      { name: "format", type: "enum", enumValues: EDITION_FORMAT_VALUES },
      { name: "description", type: "text", nullable: true },
      { name: "publisher", type: "varchar", nullable: true },
      { name: "published_year", type: "int", nullable: true },
      { name: "page_count", type: "int", nullable: true },
      { name: "cover_image_url", type: "varchar", nullable: true },
      CREATED_AT,
      UPDATED_AT,
    ],
  },

  member_profiles: {
    description:
      "Community member directory records. Bootstrap/admin rows are filtered out for non-staff callers.",
    rowKind: "list",
    columns: [
      {
        name: "user_id",
        type: "varchar",
        description: "Primary key — Kratos identity id.",
      },
      { name: "email", type: "varchar" },
      { name: "first_name", type: "varchar", nullable: true },
      { name: "last_name", type: "varchar", nullable: true },
      { name: "gender", type: "varchar", nullable: true },
      { name: "location", type: "varchar", nullable: true },
      { name: "contact_notes", type: "varchar", nullable: true },
      { name: "avatar_url", type: "varchar", nullable: true },
      { name: "deactivated_at", type: "timestamptz", nullable: true },
      {
        name: "identity_updated_at",
        type: "timestamptz",
        description: "Last time profile was synced from the Kratos identity.",
      },
      CREATED_AT,
      UPDATED_AT,
    ],
  },

  wishes: {
    description:
      "Member wishlist records. Scoped to the current user unless the caller is platform staff.",
    rowKind: "list",
    columns: [
      ID_UUID,
      { name: "user_id", type: "varchar" },
      { name: "book_id", type: "uuid" },
      { name: "edition_id", type: "uuid", nullable: true },
      { name: "notes", type: "text", nullable: true },
      { name: "status", type: "enum", enumValues: WISH_STATUS_VALUES },
      {
        name: "closure_reason",
        type: "enum",
        enumValues: WISH_CLOSURE_REASON_VALUES,
        nullable: true,
      },
      { name: "closed_at", type: "timestamptz", nullable: true },
      { name: "fulfilled_at", type: "timestamptz", nullable: true },
      { name: "fulfilled_by_copy_id", type: "uuid", nullable: true },
      { name: "fulfilled_by_user_id", type: "varchar", nullable: true },
      { name: "last_confirmed_at", type: "timestamptz", nullable: true },
      CREATED_AT,
      UPDATED_AT,
    ],
  },
};
