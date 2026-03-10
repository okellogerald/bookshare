ALTER TABLE "editions" ADD COLUMN "description" text;--> statement-breakpoint
UPDATE "editions" e
SET "description" = b."description"
FROM "books" b
WHERE e."book_id" = b."id"
  AND e."description" IS NULL
  AND b."description" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "description";--> statement-breakpoint
