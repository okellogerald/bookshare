CREATE TYPE "public"."copy_loan_type" AS ENUM('lent', 'rented', 'checked_out');--> statement-breakpoint
CREATE TYPE "public"."counterparty_type" AS ENUM('member', 'external');--> statement-breakpoint
CREATE TABLE "copy_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"copy_id" uuid NOT NULL,
	"loan_type" "copy_loan_type" NOT NULL,
	"counterparty_type" "counterparty_type" NOT NULL,
	"counterparty_user_id" varchar(255),
	"external_name" varchar(255),
	"external_contact" varchar(500),
	"notes" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "copy_loans_counterparty_consistency" CHECK ((
        ("copy_loans"."counterparty_type" = 'member' AND "copy_loans"."counterparty_user_id" IS NOT NULL AND "copy_loans"."external_name" IS NULL AND "copy_loans"."external_contact" IS NULL)
        OR
        ("copy_loans"."counterparty_type" = 'external' AND "copy_loans"."counterparty_user_id" IS NULL AND "copy_loans"."external_name" IS NOT NULL)
      )),
	CONSTRAINT "copy_loans_returned_after_started" CHECK ("copy_loans"."returned_at" IS NULL OR "copy_loans"."returned_at" >= "copy_loans"."started_at")
);
--> statement-breakpoint
ALTER TABLE "copies" DROP CONSTRAINT "copies_borrower_user_id_member_profiles_user_id_fk";
--> statement-breakpoint
ALTER TABLE "copy_loans" ADD CONSTRAINT "copy_loans_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_loans" ADD CONSTRAINT "copy_loans_counterparty_user_id_member_profiles_user_id_fk" FOREIGN KEY ("counterparty_user_id") REFERENCES "public"."member_profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "copy_loans_user_id_idx" ON "copy_loans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "copy_loans_copy_id_idx" ON "copy_loans" USING btree ("copy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "copy_loans_active_copy_idx" ON "copy_loans" USING btree ("copy_id") WHERE "copy_loans"."returned_at" IS NULL;--> statement-breakpoint
INSERT INTO "copy_loans" (
	"user_id",
	"copy_id",
	"loan_type",
	"counterparty_type",
	"counterparty_user_id",
	"notes",
	"started_at",
	"created_by"
)
SELECT
	c."user_id",
	c."id",
	((c."status")::text)::"copy_loan_type",
	'member'::"counterparty_type",
	c."borrower_user_id",
	'Backfilled from copies.borrower_user_id during copy_loans migration',
	now(),
	c."user_id"
FROM "copies" c
WHERE c."status" IN ('lent', 'rented', 'checked_out')
  AND c."borrower_user_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "copies" DROP COLUMN "borrower_user_id";--> statement-breakpoint
ALTER TABLE "copy_events" DROP COLUMN "amount";--> statement-breakpoint
ALTER TABLE "copy_events" DROP COLUMN "currency";
