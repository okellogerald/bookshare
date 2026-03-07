DROP VIEW IF EXISTS "copies_detail";--> statement-breakpoint
ALTER TABLE "copies" DROP COLUMN "acquisition_type";--> statement-breakpoint
ALTER TABLE "copies" DROP COLUMN "acquisition_date";--> statement-breakpoint
ALTER TABLE "copies" DROP COLUMN "location";--> statement-breakpoint
DROP TYPE "public"."acquisition_type";
