-- ═══════════════════════════════════════════════════════════════
-- PostgREST Read API Setup
-- Versioned migration for RLS, views, grants, and schema reload.
-- ═══════════════════════════════════════════════════════════════

-- ─── Close Anonymous Access ─────────────────────────────────
-- BookShare is a closed platform. No anonymous access to any table or view.
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM postgrest_anon;

-- ─── Grant SELECT to Authenticated Role ─────────────────────
GRANT SELECT ON ALL TABLES IN SCHEMA public TO postgrest_auth;

-- ─── Enable RLS on User-Scoped Tables ───────────────────────

ALTER TABLE copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Ensure helper exists even on pre-existing DBs where init.sql wasn't re-run
CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'sub';
$$ LANGUAGE sql STABLE;

-- Enforce authentication for non-public PostgREST resources.
CREATE OR REPLACE FUNCTION pgrst_auth_guard() RETURNS void AS $$
DECLARE
  claims_json text;
  request_path text;
  request_relation text;
BEGIN
  claims_json := current_setting('request.jwt.claims', true);
  IF claims_json IS NULL OR claims_json = '' OR (claims_json::json->>'sub') IS NULL THEN
    request_path := coalesce(current_setting('request.path', true), '');
    request_relation := lower(split_part(trim(both '/' from request_path), '/', 1));

    IF request_relation NOT IN (
      'browse_listings',
      'browse_wishes',
      'books_with_authors',
      'books_with_categories',
      'editions',
      'categories'
    ) THEN
      RAISE insufficient_privilege USING MESSAGE = 'authentication required';
    END IF;
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

-- ─── RLS Policies: copy_loans ───────────────────────────────

DROP POLICY IF EXISTS copy_loans_anon_deny ON copy_loans;
CREATE POLICY copy_loans_anon_deny ON copy_loans
  FOR SELECT TO postgrest_anon
  USING (false);

DROP POLICY IF EXISTS copy_loans_auth_select ON copy_loans;
CREATE POLICY copy_loans_auth_select ON copy_loans
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
  -- Hide bootstrap/admin account from community-facing reads.
  USING (lower(coalesce(email, '')) <> 'admin@bookshare.local');

-- ─── RLS Policies: copy_images ─────────────────────────────

DROP POLICY IF EXISTS copy_images_anon_deny ON copy_images;
CREATE POLICY copy_images_anon_deny ON copy_images
  FOR SELECT TO postgrest_anon
  USING (false);

DROP POLICY IF EXISTS copy_images_auth_select ON copy_images;
CREATE POLICY copy_images_auth_select ON copy_images
  FOR SELECT TO postgrest_auth
  USING (true);

-- ─── RLS Policies: notifications ───────────────────────────

DROP POLICY IF EXISTS notifications_anon_deny ON notifications;
CREATE POLICY notifications_anon_deny ON notifications
  FOR SELECT TO postgrest_anon
  USING (false);

DROP POLICY IF EXISTS notifications_auth_select ON notifications;
CREATE POLICY notifications_auth_select ON notifications
  FOR SELECT TO postgrest_auth
  USING (user_id = current_user_id());

-- ─── RLS Policies: wishes ───────────────────────────────────

ALTER TABLE wishes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wishes_anon_deny ON wishes;
CREATE POLICY wishes_anon_deny ON wishes
  FOR SELECT TO postgrest_anon
  USING (false);

DROP POLICY IF EXISTS wishes_auth_select ON wishes;
CREATE POLICY wishes_auth_select ON wishes
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
      json_build_object('thema_code', c.thema_code, 'name', c.name)
    ) FILTER (WHERE c.thema_code IS NOT NULL),
    '[]'::json
  ) AS categories
FROM books b
LEFT JOIN book_categories bc ON bc.book_id = b.id
LEFT JOIN categories c ON c.thema_code = bc.thema_code
GROUP BY b.id;

-- Editions with book info
DROP VIEW IF EXISTS editions_with_books;
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

-- Category passthrough. Thema hierarchy is stored in source metadata, not in SQL.
DROP VIEW IF EXISTS category_tree;
CREATE VIEW category_tree AS
SELECT
  c.*,
  NULL::varchar(255) AS parent_name,
  NULL::varchar(20) AS parent_thema_code
FROM categories c;

-- ─── Browse Listings View ───────────────────────────────────
-- Cross-user view of all available/lent copies with owner and borrower profile info.
-- Does NOT use security_invoker — intentionally bypasses RLS so all
-- authenticated users can browse community listings.

DROP VIEW IF EXISTS browse_listings;
CREATE OR REPLACE VIEW browse_listings AS
SELECT
  c.id,
  c.user_id,
  active_loan.counterparty_user_id AS borrower_user_id,
  c.edition_id,
  c.condition,
  c.status,
  c.share_type,
  c.contact_note,
  c.last_confirmed_at,
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
  e.description AS edition_description,
  b.language AS book_language,
  owner_profile.first_name AS owner_first_name,
  owner_profile.last_name AS owner_last_name,
  borrower_profile.first_name AS borrower_first_name,
  borrower_profile.last_name AS borrower_last_name,
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
LEFT JOIN LATERAL (
  SELECT
    cl.counterparty_user_id
  FROM copy_loans cl
  WHERE cl.copy_id = c.id
    AND cl.returned_at IS NULL
    AND cl.counterparty_type = 'member'
  ORDER BY cl.started_at DESC
  LIMIT 1
) AS active_loan ON TRUE
LEFT JOIN member_profiles borrower_profile ON borrower_profile.user_id = active_loan.counterparty_user_id
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
  owner_profile.first_name,
  owner_profile.last_name,
  active_loan.counterparty_user_id,
  borrower_profile.first_name,
  borrower_profile.last_name,
  primary_image.image_url;

-- Grant browse view to authenticated users only
GRANT SELECT ON browse_listings TO postgrest_auth;

-- ─── Browse Wishlist View ─────────────────────────────────
-- Cross-user grouped view of active wishes by book.
-- Does NOT use security_invoker — intentionally bypasses RLS so all
-- authenticated users can browse the community wishlist.

DROP VIEW IF EXISTS browse_wants;
DROP VIEW IF EXISTS browse_wishes;
CREATE OR REPLACE VIEW browse_wishes AS
SELECT
  b.id AS book_id,
  NULL::uuid AS edition_id,
  wb.wish_count,
  b.title AS book_title,
  b.subtitle AS book_subtitle,
  representative_edition.description AS edition_description,
  b.language AS book_language,
  representative_edition.isbn AS edition_isbn,
  representative_edition.format AS edition_format,
  representative_edition.cover_image_url AS edition_cover_image_url,
  wb.wishers,
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
    COUNT(*)::int AS wish_count,
    json_agg(
      json_build_object(
        'user_id', w.user_id,
        'first_name', mp.first_name,
        'last_name', mp.last_name,
        'location', mp.location,
        'contact_notes', mp.contact_notes,
        'avatar_url', mp.avatar_url,
        'notes', w.notes,
        'created_at', w.created_at,
        'last_confirmed_at', w.last_confirmed_at
      )
      ORDER BY w.created_at DESC
    ) AS wishers
  FROM wishes w
  LEFT JOIN member_profiles mp ON mp.user_id = w.user_id
  WHERE w.status = 'active'
  GROUP BY w.book_id
) AS wb ON wb.book_id = b.id
LEFT JOIN LATERAL (
  SELECT
    e.description,
    e.isbn,
    e.format,
    e.cover_image_url
  FROM editions e
  WHERE e.book_id = b.id
  ORDER BY
    (e.cover_image_url IS NULL) ASC,
    e.isbn ASC NULLS LAST,
    e.created_at ASC
  LIMIT 1
) AS representative_edition ON TRUE;

-- Grant browse wishes view to authenticated users only
GRANT SELECT ON browse_wishes TO postgrest_auth;

-- ─── Fulfilled Wishlist History View ───────────────────────
-- Per-user history for both sides of a fulfilled exchange:
-- 1) wishes fulfilled for me (recipient), and
-- 2) wishes I fulfilled for others (fulfiller).
-- Intentionally bypasses RLS but hard-filters by current_user_id().

DROP VIEW IF EXISTS fulfilled_wants_history;
DROP VIEW IF EXISTS fulfilled_wishes_history;
CREATE OR REPLACE VIEW fulfilled_wishes_history AS
SELECT
  w.id AS wish_id,
  w.user_id AS recipient_user_id,
  recipient.first_name AS recipient_first_name,
  recipient.last_name AS recipient_last_name,
  recipient.avatar_url AS recipient_avatar_url,
  w.fulfilled_by_user_id AS fulfiller_user_id,
  fulfiller.first_name AS fulfiller_first_name,
  fulfiller.last_name AS fulfiller_last_name,
  fulfiller.avatar_url AS fulfiller_avatar_url,
  w.book_id,
  b.title AS book_title,
  b.subtitle AS book_subtitle,
  w.edition_id AS wished_edition_id,
  wished_edition.isbn AS wished_edition_isbn,
  wished_edition.format AS wished_edition_format,
  wished_edition.cover_image_url AS wished_edition_cover_image_url,
  w.fulfilled_by_copy_id AS fulfilled_copy_id,
  fulfilled_copy.edition_id AS fulfilled_edition_id,
  fulfilled_edition.isbn AS fulfilled_edition_isbn,
  fulfilled_edition.format AS fulfilled_edition_format,
  fulfilled_edition.cover_image_url AS fulfilled_edition_cover_image_url,
  w.notes AS wisher_notes,
  w.fulfilled_at,
  fulfillment_event.to_status AS fulfillment_type,
  fulfillment_event.notes AS fulfillment_notes,
  fulfillment_event.created_at AS fulfillment_recorded_at
FROM wishes w
JOIN books b ON b.id = w.book_id
LEFT JOIN editions wished_edition ON wished_edition.id = w.edition_id
LEFT JOIN copies fulfilled_copy ON fulfilled_copy.id = w.fulfilled_by_copy_id
LEFT JOIN editions fulfilled_edition ON fulfilled_edition.id = fulfilled_copy.edition_id
LEFT JOIN member_profiles recipient ON recipient.user_id = w.user_id
LEFT JOIN member_profiles fulfiller ON fulfiller.user_id = w.fulfilled_by_user_id
LEFT JOIN LATERAL (
  SELECT
    ce.to_status,
    ce.notes,
    ce.created_at
  FROM copy_events ce
  WHERE ce.copy_id = w.fulfilled_by_copy_id
    AND ce.performed_by = w.fulfilled_by_user_id
    AND ce.to_status IN ('lent', 'gone')
    AND (
      ce.metadata ->> 'counterpartyUserId' = w.user_id
      OR ce.metadata ->> 'counterparty_user_id' = w.user_id
      OR ce.metadata IS NULL
    )
  ORDER BY ce.created_at DESC
  LIMIT 1
) AS fulfillment_event ON TRUE
WHERE w.status = 'fulfilled'
  AND (
    w.user_id = current_user_id()
    OR w.fulfilled_by_user_id = current_user_id()
  );

GRANT SELECT ON fulfilled_wishes_history TO postgrest_auth;

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

-- Refresh PostgREST schema cache so newly created/updated views are exposed
-- immediately when this migration is applied while PostgREST is already running.
NOTIFY pgrst, 'reload schema';
