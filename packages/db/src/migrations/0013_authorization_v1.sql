CREATE TYPE "public"."organization_membership_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."permission_grant_scope_type" AS ENUM('platform', 'bookstore');--> statement-breakpoint

ALTER TABLE "organization_memberships"
  ADD COLUMN "status" "organization_membership_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint

ALTER TABLE "organization_memberships"
  ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint

CREATE INDEX "organization_memberships_org_status_idx"
  ON "organization_memberships" USING btree ("organization_id","status");--> statement-breakpoint

CREATE TABLE "permission_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "permission" varchar(128) NOT NULL,
  "scope_type" "permission_grant_scope_type" NOT NULL,
  "scope_id" varchar(255) NOT NULL,
  "granted_by" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX "permission_grants_user_permission_scope_unique"
  ON "permission_grants" USING btree ("user_id","permission","scope_type","scope_id");--> statement-breakpoint

CREATE INDEX "permission_grants_user_idx"
  ON "permission_grants" USING btree ("user_id");--> statement-breakpoint

CREATE INDEX "permission_grants_scope_idx"
  ON "permission_grants" USING btree ("scope_type","scope_id");--> statement-breakpoint

NOTIFY pgrst, 'reload schema';
