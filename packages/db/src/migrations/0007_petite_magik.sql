UPDATE "editions"
SET "format" = 'paperback'
WHERE "format" IN ('ebook', 'audiobook');--> statement-breakpoint

-- Views in infra/postgres/post-migration.sql may depend on editions.format.
-- Drop them here so enum type migration can run safely on existing environments.
DROP VIEW IF EXISTS "browse_wants";--> statement-breakpoint
DROP VIEW IF EXISTS "browse_listings";--> statement-breakpoint
DROP VIEW IF EXISTS "copies_detail";--> statement-breakpoint
DROP VIEW IF EXISTS "editions_with_books";--> statement-breakpoint

ALTER TYPE "public"."book_format" RENAME TO "book_format_old";--> statement-breakpoint
CREATE TYPE "public"."book_format" AS ENUM('hardcover', 'paperback', 'mass_market');--> statement-breakpoint

ALTER TABLE "editions"
  ALTER COLUMN "format" TYPE "public"."book_format"
  USING (
    CASE
      WHEN "format"::text IN ('ebook', 'audiobook') THEN 'paperback'
      ELSE "format"::text
    END
  )::"public"."book_format";--> statement-breakpoint

DROP TYPE "public"."book_format_old";--> statement-breakpoint

UPDATE "member_profiles"
SET "gender" = 'GENDER_UNSPECIFIED'
WHERE upper(replace(trim(coalesce("gender", '')), '-', '_')) IN (
  'GENDER_DIVERSE',
  'DIVERSE'
);--> statement-breakpoint
