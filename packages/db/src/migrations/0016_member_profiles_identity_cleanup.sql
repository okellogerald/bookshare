DROP VIEW IF EXISTS "fulfilled_wishes_history";--> statement-breakpoint
DROP VIEW IF EXISTS "fulfilled_wants_history";--> statement-breakpoint
DROP VIEW IF EXISTS "browse_wishes";--> statement-breakpoint
DROP VIEW IF EXISTS "browse_wants";--> statement-breakpoint
DROP VIEW IF EXISTS "browse_listings";--> statement-breakpoint
DROP POLICY IF EXISTS member_profiles_auth_select ON member_profiles;--> statement-breakpoint
ALTER TABLE "member_profiles" RENAME COLUMN "city_area" TO "location";--> statement-breakpoint
ALTER TABLE "member_profiles" RENAME COLUMN "contact_handle" TO "contact_notes";--> statement-breakpoint
ALTER TABLE "member_profiles" DROP CONSTRAINT IF EXISTS "member_profiles_username_unique";--> statement-breakpoint
ALTER TABLE "member_profiles" DROP COLUMN IF EXISTS "username";--> statement-breakpoint
ALTER TABLE "member_profiles" DROP COLUMN IF EXISTS "display_name";--> statement-breakpoint
ALTER TABLE "member_profiles" DROP COLUMN IF EXISTS "nickname";--> statement-breakpoint
