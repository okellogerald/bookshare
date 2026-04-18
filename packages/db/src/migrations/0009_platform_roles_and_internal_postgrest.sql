-- Rename legacy elevated roles to platform roles and make PostgREST internal-only.

DROP INDEX IF EXISTS staff_roles_user_role_unique;

ALTER TYPE staff_role RENAME TO staff_role_old;
CREATE TYPE staff_role AS ENUM ('platform_admin', 'platform_staff');

ALTER TABLE staff_roles
  ALTER COLUMN role TYPE text USING role::text;

UPDATE staff_roles
SET role = CASE role
  WHEN 'owner' THEN 'platform_admin'
  WHEN 'manager' THEN 'platform_staff'
  WHEN 'staff' THEN 'platform_staff'
  WHEN 'viewer' THEN 'platform_staff'
  ELSE role
END;

DELETE FROM staff_roles left_role
USING staff_roles right_role
WHERE left_role.user_id = right_role.user_id
  AND left_role.role = right_role.role
  AND left_role.id > right_role.id;

ALTER TABLE staff_roles
  ALTER COLUMN role TYPE staff_role USING role::staff_role;

DROP TYPE staff_role_old;

CREATE UNIQUE INDEX staff_roles_user_role_unique
  ON staff_roles USING btree (user_id, role);

CREATE OR REPLACE FUNCTION is_internal_service_request() RETURNS boolean AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'internal',
    'false'
  ) = 'true';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION pgrst_auth_guard() RETURNS void AS $$
BEGIN
  IF NOT is_internal_service_request() THEN
    RAISE insufficient_privilege USING MESSAGE = 'internal access only';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION is_internal_service_request() TO postgrest_anon, postgrest_auth;
GRANT EXECUTE ON FUNCTION pgrst_auth_guard() TO postgrest_anon, postgrest_auth;

DROP POLICY IF EXISTS copies_auth_select ON copies;
CREATE POLICY copies_auth_select ON copies
  FOR SELECT TO postgrest_auth
  USING (is_internal_service_request() OR user_id = current_user_id());

DROP POLICY IF EXISTS copy_events_auth_select ON copy_events;
CREATE POLICY copy_events_auth_select ON copy_events
  FOR SELECT TO postgrest_auth
  USING (is_internal_service_request() OR user_id = current_user_id());

DROP POLICY IF EXISTS copy_loans_auth_select ON copy_loans;
CREATE POLICY copy_loans_auth_select ON copy_loans
  FOR SELECT TO postgrest_auth
  USING (is_internal_service_request() OR user_id = current_user_id());

DROP POLICY IF EXISTS collections_auth_select ON collections;
CREATE POLICY collections_auth_select ON collections
  FOR SELECT TO postgrest_auth
  USING (is_internal_service_request() OR user_id = current_user_id());

DROP POLICY IF EXISTS collection_copies_auth_select ON collection_copies;
CREATE POLICY collection_copies_auth_select ON collection_copies
  FOR SELECT TO postgrest_auth
  USING (
    is_internal_service_request()
    OR collection_id IN (
      SELECT id FROM collections WHERE user_id = current_user_id()
    )
  );

DROP POLICY IF EXISTS member_profiles_auth_select ON member_profiles;
CREATE POLICY member_profiles_auth_select ON member_profiles
  FOR SELECT TO postgrest_auth
  USING (
    is_internal_service_request()
    OR lower(coalesce(email, '')) <> 'admin@bookshare.local'
  );

DROP POLICY IF EXISTS copy_images_auth_select ON copy_images;
CREATE POLICY copy_images_auth_select ON copy_images
  FOR SELECT TO postgrest_auth
  USING (true);

DROP POLICY IF EXISTS notifications_auth_select ON notifications;
CREATE POLICY notifications_auth_select ON notifications
  FOR SELECT TO postgrest_auth
  USING (is_internal_service_request() OR user_id = current_user_id());

DROP POLICY IF EXISTS wishes_auth_select ON wishes;
CREATE POLICY wishes_auth_select ON wishes
  FOR SELECT TO postgrest_auth
  USING (is_internal_service_request() OR user_id = current_user_id());

DROP POLICY IF EXISTS copies_staff_select ON copies;
DROP POLICY IF EXISTS wishes_staff_select ON wishes;

NOTIFY pgrst, 'reload schema';
