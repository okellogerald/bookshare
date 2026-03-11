ALTER TABLE "editions" ADD COLUMN "description" text;--> statement-breakpoint
DROP VIEW IF EXISTS "books_with_authors";--> statement-breakpoint
DROP VIEW IF EXISTS "books_with_categories";--> statement-breakpoint
DROP VIEW IF EXISTS "browse_listings";--> statement-breakpoint
DROP VIEW IF EXISTS "browse_wants";--> statement-breakpoint
UPDATE "editions" e
SET "description" = b."description"
FROM "books" b
WHERE e."book_id" = b."id"
  AND e."description" IS NULL
  AND b."description" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "description";--> statement-breakpoint
