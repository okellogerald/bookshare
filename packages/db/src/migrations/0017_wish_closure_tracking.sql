CREATE TYPE "public"."wish_closure_reason" AS ENUM('removed_by_wisher', 'matched_member_lent', 'matched_member_gone');--> statement-breakpoint
ALTER TABLE "wishes" ADD COLUMN "closure_reason" "wish_closure_reason";--> statement-breakpoint
ALTER TABLE "wishes" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "wishes"
SET "closed_at" = COALESCE("fulfilled_at", "updated_at", "created_at")
WHERE "status" <> 'active'
  AND "closed_at" IS NULL;--> statement-breakpoint
UPDATE "wishes" AS w
SET "closure_reason" = CASE
  WHEN w."status" = 'cancelled' THEN 'removed_by_wisher'::"wish_closure_reason"
  WHEN EXISTS (
    SELECT 1
    FROM "copy_events" ce
    WHERE ce."copy_id" = w."fulfilled_by_copy_id"
      AND ce."to_status" = 'lent'
      AND ce."metadata"->>'counterpartyUserId' = w."user_id"
  ) THEN 'matched_member_lent'::"wish_closure_reason"
  WHEN EXISTS (
    SELECT 1
    FROM "copy_loans" cl
    WHERE cl."copy_id" = w."fulfilled_by_copy_id"
      AND cl."counterparty_type" = 'member'
      AND cl."counterparty_user_id" = w."user_id"
  ) THEN 'matched_member_lent'::"wish_closure_reason"
  WHEN w."status" = 'fulfilled' THEN 'matched_member_gone'::"wish_closure_reason"
  ELSE w."closure_reason"
END
WHERE w."status" <> 'active'
  AND w."closure_reason" IS NULL;
