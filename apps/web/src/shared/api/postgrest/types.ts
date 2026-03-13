/**
 * PostgREST response types.
 *
 * These mirror the PostgreSQL tables and views exposed via PostgREST.
 * Used for typed reads through the PostgREST proxy.
 */

// ─── Base Table Types ───────────────────────────────────────

export interface PgBook {
  id: string;
  title: string;
  subtitle: string | null;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface PgAuthor {
  id: string;
  name: string;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface PgEdition {
  id: string;
  book_id: string;
  isbn: string | null;
  format: string;
  description: string | null;
  publisher: string | null;
  published_year: number | null;
  page_count: number | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PgBookQuote {
  id: string;
  edition_id: string;
  text: string;
  chapter: string | null;
  added_by: string;
  created_at: string;
}

/** book_quotes_with_book view — quotes joined through editions to expose book_id */
export interface PgBookQuoteWithBook extends PgBookQuote {
  book_id: string;
}

export interface PgCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PgCopy {
  id: string;
  user_id: string;
  edition_id: string;
  condition: string;
  status: string;
  notes: string | null;
  share_type: string | null;
  contact_note: string | null;
  last_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PgCopyEvent {
  id: string;
  copy_id: string;
  user_id: string;
  event_type: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface PgCopyLoan {
  id: string;
  user_id: string;
  copy_id: string;
  loan_type: "lent" | "rented" | "checked_out";
  counterparty_type: "member" | "external";
  counterparty_user_id: string | null;
  external_name: string | null;
  external_contact: string | null;
  notes: string | null;
  started_at: string;
  due_at: string | null;
  returned_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PgCollection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PgMemberProfile {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  location: string | null;
  contact_notes: string | null;
  avatar_url: string | null;
  deactivated_at: string | null;
  identity_updated_at: string;
  created_at: string;
  updated_at: string;
}

export interface PgCopyImage {
  id: string;
  copy_id: string;
  user_id: string;
  object_key: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

// ─── View Types (PostgREST views) ──────────────────────────

/** PostgREST resource-embedding: books?select=*,book_authors(author:authors(*)) */
export interface PgBookWithAuthors extends PgBook {
  book_authors: Array<{
    author: PgAuthor;
  }>;
}

/** books_with_authors SQL view — flat authors JSON array */
export interface PgBookWithAuthorsView extends PgBook {
  authors: Array<{ id: string; name: string }>;
}

/** books_with_categories SQL view — flat categories JSON array */
export interface PgBookWithCategoriesView extends PgBook {
  categories: Array<{ id: string; name: string; slug: string }>;
}

export interface PgBookWithCategories extends PgBook {
  book_categories: Array<{
    category: PgCategory;
  }>;
}

export interface PgEditionWithBook extends PgEdition {
  book: PgBook;
}

export interface PgCopyDetail extends PgCopy {
  edition: PgEdition & {
    book: PgBook;
  };
  images?: PgCopyImage[];
  active_loan?: PgCopyLoan[];
}

export interface PgCopyEventDetail extends PgCopyEvent {
  copy: PgCopy;
}

/** browse_listings view — cross-user, all available copies with book info */
export interface PgBrowseListing {
  id: string;
  user_id: string;
  borrower_user_id: string | null;
  edition_id: string;
  condition: string;
  status: string;
  share_type: string | null;
  contact_note: string | null;
  last_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  isbn: string | null;
  format: string;
  publisher: string | null;
  published_year: number | null;
  page_count: number | null;
  cover_image_url: string | null;
  book_id: string;
  book_title: string;
  book_subtitle: string | null;
  edition_description: string | null;
  book_language: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  borrower_first_name: string | null;
  borrower_last_name: string | null;
  primary_image_url: string | null;
  authors: Array<{ id: string; name: string }>;
}

export interface PgCategoryTree extends PgCategory {
  parent_name: string | null;
}

/** wishes table — user-scoped via RLS */
export interface PgWish {
  id: string;
  user_id: string;
  book_id: string;
  edition_id: string | null;
  notes: string | null;
  status: "active" | "fulfilled" | "cancelled";
  closure_reason:
    | "removed_by_wisher"
    | "matched_member_lent"
    | "matched_member_gone"
    | null;
  closed_at: string | null;
  fulfilled_at: string | null;
  fulfilled_by_copy_id: string | null;
  fulfilled_by_user_id: string | null;
  last_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** wishes table with embedded book via select=*,book:books(*) */
export interface PgWishWithBook extends PgWish {
  book: PgBook | null;
}

/** browse_wishes view — cross-user, grouped active wishes by book */
export interface PgBrowseWish {
  book_id: string;
  edition_id: string | null;
  wish_count: number;
  want_count: number;
  book_title: string;
  book_subtitle: string | null;
  edition_description: string | null;
  book_language: string;
  edition_isbn: string | null;
  edition_format: string | null;
  edition_cover_image_url: string | null;
  authors: Array<{ id: string; name: string }>;
  wishers: Array<{
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    location: string | null;
    contact_notes: string | null;
    avatar_url: string | null;
    notes: string | null;
    created_at: string;
    last_confirmed_at: string | null;
  }>;
  wanters: PgBrowseWish["wishers"];
}

/** fulfilled_wishes_history view — per-user exchange history for recipient/fulfiller */
export interface PgFulfilledWishHistory {
  wish_id: string;
  want_id: string;
  recipient_user_id: string;
  recipient_first_name: string | null;
  recipient_last_name: string | null;
  recipient_avatar_url: string | null;
  fulfiller_user_id: string | null;
  fulfiller_first_name: string | null;
  fulfiller_last_name: string | null;
  fulfiller_avatar_url: string | null;
  book_id: string;
  book_title: string;
  book_subtitle: string | null;
  wished_edition_id: string | null;
  wanted_edition_id: string | null;
  wished_edition_isbn: string | null;
  wanted_edition_isbn: string | null;
  wished_edition_format: string | null;
  wanted_edition_format: string | null;
  wished_edition_cover_image_url: string | null;
  wanted_edition_cover_image_url: string | null;
  fulfilled_copy_id: string | null;
  fulfilled_edition_id: string | null;
  fulfilled_edition_isbn: string | null;
  fulfilled_edition_format: string | null;
  fulfilled_edition_cover_image_url: string | null;
  wisher_notes: string | null;
  wanter_notes: string | null;
  fulfilled_at: string | null;
  fulfillment_type: "lent" | "gone" | null;
  fulfillment_notes: string | null;
  fulfillment_recorded_at: string | null;
}

// ─── Convenience Aliases ────────────────────────────────────

export type PgQuote = PgBookQuote;
export type PgCopyWithDetails = PgCopyDetail;
export type PgCategoryWithParent = PgCategoryTree;
export type PgCollectionWithCopies = PgCollection & {
  collection_copies: Array<{
    copy: PgCopy;
  }>;
};
export type PgCopyEventWithCopy = PgCopyEventDetail;

// Temporary aliases while downstream modules finish the rename.
export type PgWant = PgWish;
export type PgWantWithBook = PgWishWithBook;
export type PgBrowseWant = PgBrowseWish;
export type PgFulfilledWantHistory = PgFulfilledWishHistory;
