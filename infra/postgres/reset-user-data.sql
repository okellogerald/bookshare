-- ═══════════════════════════════════════════════════════════════
-- Reset App State (dev)
-- Keeps catalog data and member profiles.
-- Expects psql variable: delete_member_email
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- User-generated inventory and community activity.
TRUNCATE TABLE
  collection_copies,
  collections,
  copy_loans,
  copy_events,
  copy_images,
  wishes,
  copies,
  notifications,
  book_quotes
RESTART IDENTITY;

-- Remove inventory-only importer refs so future inventory imports start fresh.
DELETE FROM import_entity_refs
WHERE entity_type IN ('copies', 'wishes');

-- Drop import runs that no longer retain catalog refs or catalog payloads.
DELETE FROM import_runs AS ir
WHERE NOT EXISTS (
    SELECT 1
    FROM import_entity_refs AS ier
    WHERE ier.run_id = ir.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM import_run_payloads AS irp
    WHERE irp.run_id = ir.id
      AND irp.entity_type IN ('books', 'editions')
  );

-- Remove the local Codex auth check profile if present.
DELETE FROM member_profiles
WHERE email = :'delete_member_email';

COMMIT;
