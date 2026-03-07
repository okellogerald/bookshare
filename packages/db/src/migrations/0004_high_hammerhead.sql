ALTER TABLE "member_profiles" ADD COLUMN "email" varchar(320);--> statement-breakpoint
CREATE INDEX "member_profiles_email_idx" ON "member_profiles" USING btree ("email");--> statement-breakpoint
UPDATE "member_profiles"
SET "email" = lower("username")
WHERE "email" IS NULL
  AND "username" ILIKE '%@%';
