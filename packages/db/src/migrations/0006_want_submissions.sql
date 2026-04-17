-- Want submissions: DB-backed intake queue for member want requests.
-- Also extends wish_closure_reason with archived_by_admin.

-- Add new closure reason to the existing enum.
ALTER TYPE "public"."wish_closure_reason" ADD VALUE IF NOT EXISTS 'archived_by_admin';

-- New status enum for want submissions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'want_submission_status'
  ) THEN
    CREATE TYPE "public"."want_submission_status" AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "want_submissions" (
  "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"                 varchar(255) NOT NULL,
  "user_email"              varchar(255),
  "status"                  "want_submission_status" NOT NULL DEFAULT 'pending',

  -- Book identifiers provided by the member.
  "title"                   varchar(500) NOT NULL,
  "subtitle"                varchar(500),
  "authors"                 jsonb NOT NULL DEFAULT '[]',
  "isbn"                    varchar(20),
  "language"                varchar(10),
  "book_description_notes"  text,

  -- Want detail provided by the member.
  "want_notes"              text,

  -- Review metadata set by staff.
  "reviewer_username"       varchar(255),
  "reviewed_at"             timestamp with time zone,
  "review_notes"            text,

  -- Resolved catalog references set on approval.
  "resolved_book_id"        uuid REFERENCES "books"("id") ON DELETE SET NULL,
  "resolved_wish_id"        uuid REFERENCES "wishes"("id") ON DELETE SET NULL,

  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for admin listing.
CREATE INDEX IF NOT EXISTS "want_submissions_status_idx"     ON "want_submissions" ("status");
CREATE INDEX IF NOT EXISTS "want_submissions_user_id_idx"    ON "want_submissions" ("user_id");
CREATE INDEX IF NOT EXISTS "want_submissions_created_at_idx" ON "want_submissions" ("created_at" DESC);
