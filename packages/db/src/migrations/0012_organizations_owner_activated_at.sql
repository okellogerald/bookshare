ALTER TABLE "organizations"
  ADD COLUMN "owner_activated_at" timestamp with time zone;
--> statement-breakpoint

NOTIFY pgrst, 'reload schema';
