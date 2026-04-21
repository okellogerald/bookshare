CREATE TYPE "public"."auth_organization_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."auth_organization_role" AS ENUM('admin', 'staff');--> statement-breakpoint
CREATE TYPE "public"."auth_organization_invite_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint

CREATE TABLE "auth_user_profiles" (
  "user_id" varchar(255) PRIMARY KEY NOT NULL,
  "email" varchar(320) NOT NULL,
  "first_name" varchar(255),
  "last_name" varchar(255),
  "email_verified" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "auth_user_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint

CREATE TABLE "auth_organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "status" "auth_organization_status" DEFAULT 'active' NOT NULL,
  "created_by" varchar(255) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "auth_organization_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "role" "auth_organization_role" DEFAULT 'staff' NOT NULL,
  "invited_by" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "auth_organization_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "invited_email" varchar(320) NOT NULL,
  "role" "auth_organization_role" DEFAULT 'staff' NOT NULL,
  "invited_by" varchar(255) NOT NULL,
  "accepted_by" varchar(255),
  "status" "auth_organization_invite_status" DEFAULT 'pending' NOT NULL,
  "accepted_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "auth_organization_memberships"
  ADD CONSTRAINT "auth_org_memberships_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."auth_organizations"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "auth_organization_invites"
  ADD CONSTRAINT "auth_org_invites_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."auth_organizations"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "auth_user_profiles_email_idx" ON "auth_user_profiles" USING btree ("email");--> statement-breakpoint
CREATE INDEX "auth_organizations_status_idx" ON "auth_organizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "auth_organizations_created_by_idx" ON "auth_organizations" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_org_memberships_org_user_unique" ON "auth_organization_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "auth_org_memberships_user_idx" ON "auth_organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_org_memberships_org_role_idx" ON "auth_organization_memberships" USING btree ("organization_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_org_invites_org_email_pending_unique" ON "auth_organization_invites" USING btree ("organization_id","invited_email") WHERE "auth_organization_invites"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "auth_org_invites_email_idx" ON "auth_organization_invites" USING btree ("invited_email");--> statement-breakpoint
CREATE INDEX "auth_org_invites_org_status_idx" ON "auth_organization_invites" USING btree ("organization_id","status");--> statement-breakpoint
