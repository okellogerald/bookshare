-- ═══════════════════════════════════════════════════════════════
-- Reset User Data (dev)
-- Keeps catalog data (books, editions, categories, authors).
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- User-generated and user-scoped data
TRUNCATE TABLE
  collection_copies,
  collections,
  copy_loans,
  copy_events,
  copy_images,
  wishes,
  copies,
  member_profiles,
  book_quotes
RESTART IDENTITY;

COMMIT;
