-- Replace PostgREST's per-request JWT role switching with a fixed internal
-- read-only service role. NestJS is the only application authorization layer.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgrest_read_service') THEN
    CREATE ROLE postgrest_read_service NOLOGIN;
  END IF;
END
$$;

REVOKE postgrest_anon FROM postgrest_authenticator;
REVOKE postgrest_auth FROM postgrest_authenticator;
GRANT postgrest_read_service TO postgrest_authenticator;

GRANT USAGE ON SCHEMA public TO postgrest_read_service;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO postgrest_read_service;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM postgrest_auth;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO postgrest_read_service;

REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM postgrest_anon;
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM postgrest_auth;

DROP POLICY IF EXISTS copies_auth_select ON copies;
DROP POLICY IF EXISTS copies_read_service_select ON copies;
CREATE POLICY copies_read_service_select ON copies
  FOR SELECT TO postgrest_read_service
  USING (true);

DROP POLICY IF EXISTS copy_events_auth_select ON copy_events;
DROP POLICY IF EXISTS copy_events_read_service_select ON copy_events;
CREATE POLICY copy_events_read_service_select ON copy_events
  FOR SELECT TO postgrest_read_service
  USING (true);

DROP POLICY IF EXISTS copy_loans_auth_select ON copy_loans;
DROP POLICY IF EXISTS copy_loans_read_service_select ON copy_loans;
CREATE POLICY copy_loans_read_service_select ON copy_loans
  FOR SELECT TO postgrest_read_service
  USING (true);

DROP POLICY IF EXISTS collections_auth_select ON collections;
DROP POLICY IF EXISTS collections_read_service_select ON collections;
CREATE POLICY collections_read_service_select ON collections
  FOR SELECT TO postgrest_read_service
  USING (true);

DROP POLICY IF EXISTS collection_copies_auth_select ON collection_copies;
DROP POLICY IF EXISTS collection_copies_read_service_select ON collection_copies;
CREATE POLICY collection_copies_read_service_select ON collection_copies
  FOR SELECT TO postgrest_read_service
  USING (true);

DROP POLICY IF EXISTS member_profiles_auth_select ON member_profiles;
DROP POLICY IF EXISTS member_profiles_read_service_select ON member_profiles;
CREATE POLICY member_profiles_read_service_select ON member_profiles
  FOR SELECT TO postgrest_read_service
  USING (true);

DROP POLICY IF EXISTS copy_images_auth_select ON copy_images;
DROP POLICY IF EXISTS copy_images_read_service_select ON copy_images;
CREATE POLICY copy_images_read_service_select ON copy_images
  FOR SELECT TO postgrest_read_service
  USING (true);

DROP POLICY IF EXISTS notifications_auth_select ON notifications;
DROP POLICY IF EXISTS notifications_read_service_select ON notifications;
CREATE POLICY notifications_read_service_select ON notifications
  FOR SELECT TO postgrest_read_service
  USING (true);

DROP POLICY IF EXISTS wishes_auth_select ON wishes;
DROP POLICY IF EXISTS wishes_read_service_select ON wishes;
CREATE POLICY wishes_read_service_select ON wishes
  FOR SELECT TO postgrest_read_service
  USING (true);

DROP FUNCTION IF EXISTS is_internal_service_request();
DROP FUNCTION IF EXISTS pgrst_auth_guard();

NOTIFY pgrst, 'reload schema';
