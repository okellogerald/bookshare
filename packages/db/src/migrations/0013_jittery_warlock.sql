DROP VIEW IF EXISTS "fulfilled_wishes_history";--> statement-breakpoint
DROP VIEW IF EXISTS "fulfilled_wants_history";--> statement-breakpoint
DROP VIEW IF EXISTS "browse_listings";--> statement-breakpoint
DROP VIEW IF EXISTS "copies_detail";--> statement-breakpoint
ALTER TABLE "public"."copies" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."copies" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."copy_events" ALTER COLUMN "from_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."copy_events" ALTER COLUMN "to_status" SET DATA TYPE text;--> statement-breakpoint
UPDATE "copies"
SET "status" = CASE
  WHEN "status" = 'reserved' THEN 'shelved'
  WHEN "status" IN ('rented', 'checked_out') THEN 'lent'
  WHEN "status" IN ('sold', 'donated', 'given_away', 'lost', 'damaged') THEN 'gone'
  ELSE "status"
END;--> statement-breakpoint
UPDATE "copy_events"
SET "from_status" = CASE
  WHEN "from_status" = 'reserved' THEN 'shelved'
  WHEN "from_status" IN ('rented', 'checked_out') THEN 'lent'
  WHEN "from_status" IN ('sold', 'donated', 'given_away', 'lost', 'damaged') THEN 'gone'
  ELSE "from_status"
END
WHERE "from_status" IS NOT NULL;--> statement-breakpoint
UPDATE "copy_events"
SET "to_status" = CASE
  WHEN "to_status" = 'reserved' THEN 'shelved'
  WHEN "to_status" IN ('rented', 'checked_out') THEN 'lent'
  WHEN "to_status" IN ('sold', 'donated', 'given_away', 'lost', 'damaged') THEN 'gone'
  ELSE "to_status"
END
WHERE "to_status" IS NOT NULL;--> statement-breakpoint
DROP TYPE "public"."copy_status";--> statement-breakpoint
CREATE TYPE "public"."copy_status" AS ENUM('available', 'shelved', 'lent', 'gone');--> statement-breakpoint
ALTER TABLE "public"."copies" ALTER COLUMN "status" SET DATA TYPE "public"."copy_status" USING "status"::"public"."copy_status";--> statement-breakpoint
ALTER TABLE "public"."copies" ALTER COLUMN "status" SET DEFAULT 'available';--> statement-breakpoint
ALTER TABLE "public"."copy_events" ALTER COLUMN "from_status" SET DATA TYPE "public"."copy_status" USING "from_status"::"public"."copy_status";--> statement-breakpoint
ALTER TABLE "public"."copy_events" ALTER COLUMN "to_status" SET DATA TYPE "public"."copy_status" USING "to_status"::"public"."copy_status";
