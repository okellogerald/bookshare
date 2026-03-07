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
  description: string | null;
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
  borrower_user_id: string | null;
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
  amount: string | null;
  currency: string | null;
  created_at: string;
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
  username: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  gender: string | null;
  city_area: string | null;
  contact_handle: string | null;
  avatar_url: string | null;
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
  borrower_profile?: PgMemberProfile | null;
}

export interface PgCopyEventDetail extends PgCopyEvent {
  copy: PgCopy;
}

/** browse_listings view — cross-user, all available copies with book info */
export interface PgBrowseListing {
  id: string;
  user_id: string;
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
  book_description: string | null;
  book_language: string;
  owner_username: string | null;
  owner_display_name: string | null;
  borrower_username: string | null;
  borrower_display_name: string | null;
  primary_image_url: string | null;
  authors: Array<{ id: string; name: string }>;
}

export interface PgCategoryTree extends PgCategory {
  parent_name: string | null;
}

/** wants table — user-scoped via RLS */
export interface PgWant {
  id: string;
  user_id: string;
  book_id: string;
  notes: string | null;
  status: "active" | "fulfilled" | "cancelled";
  fulfilled_at: string | null;
  fulfilled_by_copy_id: string | null;
  fulfilled_by_user_id: string | null;
  last_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** wants table with embedded book via select=*,book:books(*) */
export interface PgWantWithBook extends PgWant {
  book: PgBook | null;
}

/** browse_wants view — cross-user, grouped active wants by book */
export interface PgBrowseWant {
  book_id: string;
  want_count: number;
  book_title: string;
  book_subtitle: string | null;
  book_description: string | null;
  book_language: string;
  authors: Array<{ id: string; name: string }>;
  wanters: Array<{
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    notes: string | null;
    created_at: string;
    last_confirmed_at: string | null;
  }>;
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
