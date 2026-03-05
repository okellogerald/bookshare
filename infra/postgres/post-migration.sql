-- ═══════════════════════════════════════════════════════════════
-- Post-Migration Setup
-- Run this AFTER Drizzle migrations create the tables.
-- ═══════════════════════════════════════════════════════════════

-- ─── Close Anonymous Access ─────────────────────────────────
-- BookShare is a closed platform. No anonymous access to any table or view.
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM postgrest_anon;

-- ─── Grant SELECT to Authenticated Role ─────────────────────
GRANT SELECT ON ALL TABLES IN SCHEMA public TO postgrest_auth;

-- ─── Enable RLS on User-Scoped Tables ───────────────────────

ALTER TABLE copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_images ENABLE ROW LEVEL SECURITY;

-- Ensure helper exists even on pre-existing DBs where init.sql wasn't re-run
CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'sub';
$$ LANGUAGE sql STABLE;

-- Enforce authentication for all PostgREST requests regardless of role claim
CREATE OR REPLACE FUNCTION pgrst_auth_guard() RETURNS void AS $$
DECLARE
  claims_json text;
BEGIN
  claims_json := current_setting('request.jwt.claims', true);
  IF claims_json IS NULL OR claims_json = '' OR (claims_json::json->>'sub') IS NULL THEN
    RAISE insufficient_privilege USING MESSAGE = 'authentication required';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION pgrst_auth_guard() TO postgrest_anon, postgrest_auth;

-- ─── RLS Policies: copies ───────────────────────────────────

DROP POLICY IF EXISTS copies_anon_deny ON copies;
CREATE POLICY copies_anon_deny ON copies
  FOR SELECT TO postgrest_anon
  USING (false);

DROP POLICY IF EXISTS copies_auth_select ON copies;
CREATE POLICY copies_auth_select ON copies
  FOR SELECT TO postgrest_auth
  USING (user_id = current_user_id());

-- ─── RLS Policies: copy_events ──────────────────────────────

DROP POLICY IF EXISTS copy_events_anon_deny ON copy_events;
CREATE POLICY copy_events_anon_deny ON copy_events
  FOR SELECT TO postgrest_anon
  USING (false);

DROP POLICY IF EXISTS copy_events_auth_select ON copy_events;
CREATE POLICY copy_events_auth_select ON copy_events
  FOR SELECT TO postgrest_auth
  USING (user_id = current_user_id());

-- ─── RLS Policies: collections ──────────────────────────────

DROP POLICY IF EXISTS collections_anon_deny ON collections;
CREATE POLICY collections_anon_deny ON collections
  FOR SELECT TO postgrest_anon
  USING (false);

DROP POLICY IF EXISTS collections_auth_select ON collections;
CREATE POLICY collections_auth_select ON collections
  FOR SELECT TO postgrest_auth
  USING (user_id = current_user_id());

-- ─── RLS Policies: collection_copies ────────────────────────

DROP POLICY IF EXISTS collection_copies_anon_deny ON collection_copies;
CREATE POLICY collection_copies_anon_deny ON collection_copies
  FOR SELECT TO postgrest_anon
  USING (false);

DROP POLICY IF EXISTS collection_copies_auth_select ON collection_copies;
CREATE POLICY collection_copies_auth_select ON collection_copies
  FOR SELECT TO postgrest_auth
  USING (
    collection_id IN (
      SELECT id FROM collections WHERE user_id = current_user_id()
    )
  );

-- ─── RLS Policies: member_profiles ─────────────────────────

DROP POLICY IF EXISTS member_profiles_anon_deny ON member_profiles;
CREATE POLICY member_profiles_anon_deny ON member_profiles
  FOR SELECT TO postgrest_anon
  USING (false);

DROP POLICY IF EXISTS member_profiles_auth_select ON member_profiles;
CREATE POLICY member_profiles_auth_select ON member_profiles
  FOR SELECT TO postgrest_auth
  USING (true);

-- ─── RLS Policies: copy_images ─────────────────────────────

DROP POLICY IF EXISTS copy_images_anon_deny ON copy_images;
CREATE POLICY copy_images_anon_deny ON copy_images
  FOR SELECT TO postgrest_anon
  USING (false);

DROP POLICY IF EXISTS copy_images_auth_select ON copy_images;
CREATE POLICY copy_images_auth_select ON copy_images
  FOR SELECT TO postgrest_auth
  USING (true);

-- ─── RLS Policies: wants ───────────────────────────────────

ALTER TABLE wants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wants_anon_deny ON wants;
CREATE POLICY wants_anon_deny ON wants
  FOR SELECT TO postgrest_anon
  USING (false);

DROP POLICY IF EXISTS wants_auth_select ON wants;
CREATE POLICY wants_auth_select ON wants
  FOR SELECT TO postgrest_auth
  USING (user_id = current_user_id());

-- ─── Global Tables ──────────────────────────────────────────
-- books, authors, book_authors, editions, book_quotes, categories,
-- book_categories do NOT have RLS enabled.
-- Authenticated users can read them freely via PostgREST.

-- ─── Convenience Views ──────────────────────────────────────

-- Books with their authors as an array
CREATE OR REPLACE VIEW books_with_authors AS
SELECT
  b.*,
  COALESCE(
    json_agg(
      json_build_object('id', a.id, 'name', a.name)
    ) FILTER (WHERE a.id IS NOT NULL),
    '[]'::json
  ) AS authors
FROM books b
LEFT JOIN book_authors ba ON ba.book_id = b.id
LEFT JOIN authors a ON a.id = ba.author_id
GROUP BY b.id;

-- Books with their categories as an array
CREATE OR REPLACE VIEW books_with_categories AS
SELECT
  b.*,
  COALESCE(
    json_agg(
      json_build_object('id', c.id, 'name', c.name, 'slug', c.slug)
    ) FILTER (WHERE c.id IS NOT NULL),
    '[]'::json
  ) AS categories
FROM books b
LEFT JOIN book_categories bc ON bc.book_id = b.id
LEFT JOIN categories c ON c.id = bc.category_id
GROUP BY b.id;

-- Editions with book info
CREATE OR REPLACE VIEW editions_with_books AS
SELECT
  e.*,
  b.title AS book_title,
  b.subtitle AS book_subtitle,
  b.language AS book_language
FROM editions e
JOIN books b ON b.id = e.book_id;

-- Copies with edition and book info (user-scoped via RLS)
DROP VIEW IF EXISTS copies_detail;
CREATE OR REPLACE VIEW copies_detail AS
SELECT
  c.*,
  e.isbn,
  e.format,
  e.publisher,
  e.published_year,
  e.cover_image_url,
  b.title AS book_title,
  b.subtitle AS book_subtitle
FROM copies c
JOIN editions e ON e.id = c.edition_id
JOIN books b ON b.id = e.book_id;

-- Apply RLS to the copies_detail view (scopes to current user)
ALTER VIEW copies_detail SET (security_invoker = on);

-- Category tree (parent + children)
CREATE OR REPLACE VIEW category_tree AS
SELECT
  c.*,
  p.name AS parent_name,
  p.slug AS parent_slug
FROM categories c
LEFT JOIN categories p ON p.id = c.parent_id;

-- ─── Browse Listings View ───────────────────────────────────
-- Cross-user view of all available/lent copies with owner and borrower profile info.
-- Does NOT use security_invoker — intentionally bypasses RLS so all
-- authenticated users can browse community listings.

DROP VIEW IF EXISTS browse_listings;
CREATE OR REPLACE VIEW browse_listings AS
SELECT
  c.id,
  c.user_id,
  c.borrower_user_id,
  c.edition_id,
  c.condition,
  c.status,
  c.share_type,
  c.contact_note,
  c.last_confirmed_at,
  c.location,
  c.created_at,
  c.updated_at,
  e.isbn,
  e.format,
  e.publisher,
  e.published_year,
  e.page_count,
  e.cover_image_url,
  b.id AS book_id,
  b.title AS book_title,
  b.subtitle AS book_subtitle,
  b.description AS book_description,
  b.language AS book_language,
  owner_profile.username AS owner_username,
  owner_profile.display_name AS owner_display_name,
  borrower_profile.username AS borrower_username,
  borrower_profile.display_name AS borrower_display_name,
  primary_image.image_url AS primary_image_url,
  COALESCE(
    json_agg(
      json_build_object('id', a.id, 'name', a.name)
    ) FILTER (WHERE a.id IS NOT NULL),
    '[]'::json
  ) AS authors
FROM copies c
JOIN editions e ON e.id = c.edition_id
JOIN books b ON b.id = e.book_id
LEFT JOIN member_profiles owner_profile ON owner_profile.user_id = c.user_id
LEFT JOIN member_profiles borrower_profile ON borrower_profile.user_id = c.borrower_user_id
LEFT JOIN LATERAL (
  SELECT ci.image_url
  FROM copy_images ci
  WHERE ci.copy_id = c.id
  ORDER BY ci.sort_order ASC, ci.created_at ASC
  LIMIT 1
) AS primary_image ON TRUE
LEFT JOIN book_authors ba ON ba.book_id = b.id
LEFT JOIN authors a ON a.id = ba.author_id
WHERE c.status IN ('available', 'lent')
GROUP BY
  c.id,
  e.id,
  b.id,
  owner_profile.username,
  owner_profile.display_name,
  borrower_profile.username,
  borrower_profile.display_name,
  primary_image.image_url;

-- Grant browse view to authenticated users only
GRANT SELECT ON browse_listings TO postgrest_auth;

-- ─── Browse Wants View ────────────────────────────────────
-- Cross-user grouped view of active wants by book with wantee profiles.
-- Does NOT use security_invoker — intentionally bypasses RLS so all
-- authenticated users can browse all wanted books.

DROP VIEW IF EXISTS browse_wants;
CREATE OR REPLACE VIEW browse_wants AS
SELECT
  b.id AS book_id,
  wb.want_count,
  b.title AS book_title,
  b.subtitle AS book_subtitle,
  b.description AS book_description,
  b.language AS book_language,
  wb.wanters,
  COALESCE(
    authors_data.authors,
    '[]'::json
  ) AS authors
FROM books b
LEFT JOIN (
  SELECT
    ba.book_id,
    json_agg(
      DISTINCT jsonb_build_object('id', a.id, 'name', a.name)
    ) FILTER (WHERE a.id IS NOT NULL) AS authors
  FROM book_authors ba
  LEFT JOIN authors a ON a.id = ba.author_id
  GROUP BY ba.book_id
) AS authors_data ON authors_data.book_id = b.id
JOIN (
  SELECT
    w.book_id,
    COUNT(*)::int AS want_count,
    json_agg(
      json_build_object(
        'user_id', w.user_id,
        'username', mp.username,
        'display_name', mp.display_name,
        'notes', w.notes,
        'created_at', w.created_at,
        'last_confirmed_at', w.last_confirmed_at
      )
      ORDER BY w.created_at DESC
    ) AS wanters
  FROM wants w
  LEFT JOIN member_profiles mp ON mp.user_id = w.user_id
  WHERE w.status = 'active'
  GROUP BY w.book_id
) AS wb ON wb.book_id = b.id;

-- Grant browse wants view to authenticated users only
GRANT SELECT ON browse_wants TO postgrest_auth;

-- ─── Book Quotes with Book ID View ───────────────────────────
-- Joins quotes through editions to expose book_id for easy filtering.
-- Global table — no RLS needed.

DROP VIEW IF EXISTS book_quotes_with_book;
CREATE OR REPLACE VIEW book_quotes_with_book AS
SELECT
  bq.id,
  bq.text,
  bq.chapter,
  bq.added_by,
  bq.created_at,
  bq.edition_id,
  e.book_id
FROM book_quotes bq
JOIN editions e ON e.id = bq.edition_id;

GRANT SELECT ON book_quotes_with_book TO postgrest_auth;
