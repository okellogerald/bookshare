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

-- Ensure helper exists even on pre-existing DBs where init.sql wasn't re-run
CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'sub';
$$ LANGUAGE sql STABLE;

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
-- Cross-user view of all available copies with book, edition, and author info.
-- Does NOT use security_invoker — intentionally bypasses RLS so all
-- authenticated users can browse all available copies.

CREATE OR REPLACE VIEW browse_listings AS
SELECT
  c.id,
  c.user_id,
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
  COALESCE(
    json_agg(
      json_build_object('id', a.id, 'name', a.name)
    ) FILTER (WHERE a.id IS NOT NULL),
    '[]'::json
  ) AS authors
FROM copies c
JOIN editions e ON e.id = c.edition_id
JOIN books b ON b.id = e.book_id
LEFT JOIN book_authors ba ON ba.book_id = b.id
LEFT JOIN authors a ON a.id = ba.author_id
WHERE c.status = 'available'
GROUP BY c.id, e.id, b.id;

-- Grant browse view to authenticated users only
GRANT SELECT ON browse_listings TO postgrest_auth;

-- ─── Browse Wants View ────────────────────────────────────
-- Cross-user view of all active wants with book and author info.
-- Does NOT use security_invoker — intentionally bypasses RLS so all
-- authenticated users can browse all wanted books.

CREATE OR REPLACE VIEW browse_wants AS
SELECT
  w.id,
  w.user_id,
  w.book_id,
  w.notes,
  w.last_confirmed_at,
  w.created_at,
  w.updated_at,
  b.title AS book_title,
  b.subtitle AS book_subtitle,
  b.description AS book_description,
  b.language AS book_language,
  COALESCE(
    json_agg(
      json_build_object('id', a.id, 'name', a.name)
    ) FILTER (WHERE a.id IS NOT NULL),
    '[]'::json
  ) AS authors
FROM wants w
JOIN books b ON b.id = w.book_id
LEFT JOIN book_authors ba ON ba.book_id = b.id
LEFT JOIN authors a ON a.id = ba.author_id
GROUP BY w.id, b.id;

-- Grant browse wants view to authenticated users only
GRANT SELECT ON browse_wants TO postgrest_auth;
