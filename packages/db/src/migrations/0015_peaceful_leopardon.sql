ALTER TABLE "public"."copy_events" ALTER COLUMN "event_type" SET DATA TYPE text;--> statement-breakpoint
UPDATE "public"."copy_events"
SET "event_type" = CASE
  WHEN "event_type" = 'acquired' THEN 'listed'
  WHEN "event_type" = 'status_change' THEN 'status_changed'
  WHEN "event_type" = 'condition_change' THEN 'condition_changed'
  WHEN "event_type" = 'rented' THEN 'lent'
  ELSE "event_type"
END;--> statement-breakpoint
DROP TYPE "public"."copy_event_type";--> statement-breakpoint
CREATE TYPE "public"."copy_event_type" AS ENUM('listed', 'status_changed', 'condition_changed', 'lent', 'sold', 'returned', 'donated', 'given_away', 'lost', 'damaged', 'note_added');--> statement-breakpoint
ALTER TABLE "public"."copy_events" ALTER COLUMN "event_type" SET DATA TYPE "public"."copy_event_type" USING "event_type"::"public"."copy_event_type";
