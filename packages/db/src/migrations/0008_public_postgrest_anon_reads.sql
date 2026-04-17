-- Allow anonymous PostgREST access for explicitly public browse resources.

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
      'book_quotes_with_book',
      'editions',
      'categories'
    ) THEN
      RAISE insufficient_privilege USING MESSAGE = 'authentication required';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT SELECT ON categories TO postgrest_anon;
GRANT SELECT ON editions TO postgrest_anon;
GRANT SELECT ON books_with_authors TO postgrest_anon;
GRANT SELECT ON books_with_categories TO postgrest_anon;
GRANT SELECT ON browse_listings TO postgrest_anon;
GRANT SELECT ON browse_wishes TO postgrest_anon;
GRANT SELECT ON book_quotes_with_book TO postgrest_anon;

NOTIFY pgrst, 'reload schema';
