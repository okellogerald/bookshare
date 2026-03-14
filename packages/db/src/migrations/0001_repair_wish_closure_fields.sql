DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'wish_closure_reason'
  ) THEN
    CREATE TYPE "public"."wish_closure_reason" AS ENUM(
      'removed_by_wisher',
      'matched_member_lent',
      'matched_member_gone'
    );
  END IF;
END
$$;

ALTER TABLE "wishes"
  ADD COLUMN IF NOT EXISTS "closure_reason" "wish_closure_reason";

ALTER TABLE "wishes"
  ADD COLUMN IF NOT EXISTS "closed_at" timestamp with time zone;
