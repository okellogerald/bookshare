-- Allow staff to read all copies and wishes via PostgREST.

DROP POLICY IF EXISTS copies_staff_select ON copies;
CREATE POLICY copies_staff_select ON copies
  FOR SELECT TO postgrest_auth
  USING (
    EXISTS (
      SELECT 1
      FROM staff_roles
      WHERE user_id = current_user_id()
    )
  );

DROP POLICY IF EXISTS wishes_staff_select ON wishes;
CREATE POLICY wishes_staff_select ON wishes
  FOR SELECT TO postgrest_auth
  USING (
    EXISTS (
      SELECT 1
      FROM staff_roles
      WHERE user_id = current_user_id()
    )
  );