-- Copy submissions: DB-backed intake queue for member copy requests.

CREATE TYPE "public"."copy_submission_status" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS "copy_submissions" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"               varchar(255) NOT NULL,
  "user_email"            varchar(255),
  "status"                "copy_submission_status" NOT NULL DEFAULT 'pending',

  -- Book identifiers provided by the member.
  "title"                 varchar(500) NOT NULL,
  "subtitle"              varchar(500),
  "authors"               jsonb NOT NULL DEFAULT '[]',
  "isbn"                  varchar(20),
  "language"              varchar(10),
  "book_description_notes" text,

  -- Copy details provided by the member.
  "condition"             "copy_condition",
  "share_type"            "share_type",
  "notes"                 text,
  "contact_note"          text,

  -- Review metadata set by staff.
  "reviewer_username"     varchar(255),
  "reviewed_at"           timestamp with time zone,
  "review_notes"          text,

  -- Resolved catalog references set on approval.
  "resolved_edition_id"   uuid REFERENCES "editions"("id") ON DELETE SET NULL,
  "resolved_copy_id"      uuid REFERENCES "copies"("id") ON DELETE SET NULL,

  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for admin listing by status.
CREATE INDEX "copy_submissions_status_idx" ON "copy_submissions" ("status");
CREATE INDEX "copy_submissions_user_id_idx" ON "copy_submissions" ("user_id");
CREATE INDEX "copy_submissions_created_at_idx" ON "copy_submissions" ("created_at" DESC);
