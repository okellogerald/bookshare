CREATE TYPE "public"."want_status" AS ENUM('active', 'fulfilled', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."copy_status" ADD VALUE 'lent' BEFORE 'rented';--> statement-breakpoint
ALTER TYPE "public"."copy_event_type" ADD VALUE 'lent' BEFORE 'sold';--> statement-breakpoint
CREATE TABLE "copy_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"copy_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"object_key" varchar(1000) NOT NULL,
	"image_url" varchar(2000) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "copy_images_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "member_profiles" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"city_area" varchar(255),
	"contact_handle" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
INSERT INTO "member_profiles" ("user_id", "username", "display_name")
SELECT
	u.user_id,
	'member_' || substring(md5(u.user_id) FROM 1 FOR 12),
	'Member ' || substring(md5(u.user_id) FROM 1 FOR 6)
FROM (
	SELECT DISTINCT "user_id" FROM "copies"
	UNION
	SELECT DISTINCT "user_id" FROM "wants"
) u
WHERE u.user_id IS NOT NULL
ON CONFLICT ("user_id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "wants" DROP CONSTRAINT "wants_user_book_unique";--> statement-breakpoint
ALTER TABLE "copies" ADD COLUMN "borrower_user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "wants" ADD COLUMN "status" "want_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "wants" ADD COLUMN "fulfilled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wants" ADD COLUMN "fulfilled_by_copy_id" uuid;--> statement-breakpoint
ALTER TABLE "wants" ADD COLUMN "fulfilled_by_user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "copy_images" ADD CONSTRAINT "copy_images_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_borrower_user_id_member_profiles_user_id_fk" FOREIGN KEY ("borrower_user_id") REFERENCES "public"."member_profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wants" ADD CONSTRAINT "wants_fulfilled_by_copy_id_copies_id_fk" FOREIGN KEY ("fulfilled_by_copy_id") REFERENCES "public"."copies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wants_user_book_active_unique" ON "wants" USING btree ("user_id","book_id") WHERE "wants"."status" = 'active';
