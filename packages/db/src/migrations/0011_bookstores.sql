CREATE TYPE "public"."organization_type" AS ENUM('bookstore');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."organization_membership_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."organization_invite_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."bookstore_proposal_status" AS ENUM('active', 'withdrawn', 'expired');--> statement-breakpoint

CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "organization_type" DEFAULT 'bookstore' NOT NULL,
	"status" "organization_status" DEFAULT 'pending' NOT NULL,
	"name" varchar(255) NOT NULL,
	"website_url" varchar(2000),
	"phone" varchar(255),
	"email" varchar(320),
	"whatsapp" varchar(255),
	"instagram" varchar(255),
	"address" text,
	"contact_note" text,
	"created_by" varchar(255) NOT NULL,
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" "organization_membership_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "organization_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invited_email" varchar(320) NOT NULL,
	"invited_by" varchar(255) NOT NULL,
	"accepted_by" varchar(255),
	"status" "organization_invite_status" DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "bookstore_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"wish_id" uuid NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"message" text,
	"status" "bookstore_proposal_status" DEFAULT 'active' NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "organization_memberships"
  ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "organization_invites"
  ADD CONSTRAINT "organization_invites_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "bookstore_proposals"
  ADD CONSTRAINT "bookstore_proposals_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "bookstore_proposals"
  ADD CONSTRAINT "bookstore_proposals_wish_id_wishes_id_fk"
  FOREIGN KEY ("wish_id") REFERENCES "public"."wishes"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "organizations_status_idx" ON "organizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "organizations_type_idx" ON "organizations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "organizations_created_by_idx" ON "organizations" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_memberships_org_user_unique" ON "organization_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_user_idx" ON "organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_org_role_idx" ON "organization_memberships" USING btree ("organization_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_invites_org_email_pending_unique" ON "organization_invites" USING btree ("organization_id","invited_email") WHERE "organization_invites"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "organization_invites_email_idx" ON "organization_invites" USING btree ("invited_email");--> statement-breakpoint
CREATE INDEX "organization_invites_org_status_idx" ON "organization_invites" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "bookstore_proposals_org_wish_active_unique" ON "bookstore_proposals" USING btree ("organization_id","wish_id") WHERE "bookstore_proposals"."status" = 'active';--> statement-breakpoint
CREATE INDEX "bookstore_proposals_wish_idx" ON "bookstore_proposals" USING btree ("wish_id");--> statement-breakpoint
CREATE INDEX "bookstore_proposals_org_status_idx" ON "bookstore_proposals" USING btree ("organization_id","status");--> statement-breakpoint

NOTIFY pgrst, 'reload schema';
