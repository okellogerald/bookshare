CREATE TYPE "public"."copy_condition" AS ENUM('new', 'like_new', 'good', 'fair', 'poor');--> statement-breakpoint
CREATE TYPE "public"."copy_status" AS ENUM('available', 'shelved', 'lent', 'gone');--> statement-breakpoint
CREATE TYPE "public"."share_type" AS ENUM('lend', 'sell', 'give_away');--> statement-breakpoint
CREATE TYPE "public"."copy_event_type" AS ENUM('listed', 'status_changed', 'condition_changed', 'lent', 'sold', 'returned', 'donated', 'given_away', 'lost', 'damaged', 'note_added');--> statement-breakpoint
CREATE TYPE "public"."copy_loan_type" AS ENUM('lent', 'rented', 'checked_out');--> statement-breakpoint
CREATE TYPE "public"."counterparty_type" AS ENUM('member', 'external');--> statement-breakpoint
CREATE TYPE "public"."book_format" AS ENUM('hardcover', 'paperback', 'mass_market');--> statement-breakpoint
CREATE TYPE "public"."wish_closure_reason" AS ENUM('removed_by_wisher', 'matched_member_lent', 'matched_member_gone');--> statement-breakpoint
CREATE TYPE "public"."wish_status" AS ENUM('active', 'fulfilled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."import_entity_type" AS ENUM('books', 'editions', 'copies', 'wishes');--> statement-breakpoint
CREATE TYPE "public"."import_run_status" AS ENUM('invalid', 'validated', 'committed');--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_authors" (
	"book_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	CONSTRAINT "book_authors_book_id_author_id_pk" PRIMARY KEY("book_id","author_id")
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"subtitle" varchar(1000),
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_categories" (
	"book_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "book_categories_book_id_category_id_pk" PRIMARY KEY("book_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "collection_copies" (
	"collection_id" uuid NOT NULL,
	"copy_id" uuid NOT NULL,
	CONSTRAINT "collection_copies_collection_id_copy_id_pk" PRIMARY KEY("collection_id","copy_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"edition_id" uuid NOT NULL,
	"condition" "copy_condition" NOT NULL,
	"status" "copy_status" DEFAULT 'available' NOT NULL,
	"notes" text,
	"share_type" "share_type",
	"contact_note" text,
	"last_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copy_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"copy_id" uuid NOT NULL,
	"event_type" "copy_event_type" NOT NULL,
	"from_status" "copy_status",
	"to_status" "copy_status",
	"performed_by" varchar(255) NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"isbn" varchar(20),
	"format" "book_format" NOT NULL,
	"description" text,
	"publisher" varchar(500),
	"published_year" integer,
	"page_count" integer,
	"cover_image_url" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editions_isbn_unique" UNIQUE("isbn")
);
--> statement-breakpoint
CREATE TABLE "import_entity_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"entity_type" "import_entity_type" NOT NULL,
	"source_ref" varchar(255) NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_run_payloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"entity_type" "import_entity_type" NOT NULL,
	"row_number" integer NOT NULL,
	"source_ref" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_username" varchar(255) NOT NULL,
	"source_zip_name" varchar(1000) NOT NULL,
	"source_zip_sha256" varchar(64) NOT NULL,
	"status" "import_run_status" DEFAULT 'invalid' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"issue_count" integer DEFAULT 0 NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"validated_at" timestamp with time zone,
	"committed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "book_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"text" text NOT NULL,
	"chapter" varchar(255),
	"added_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"book_id" uuid NOT NULL,
	"edition_id" uuid,
	"notes" text,
	"status" "wish_status" DEFAULT 'active' NOT NULL,
	"closure_reason" "wish_closure_reason",
	"closed_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"fulfilled_by_copy_id" uuid,
	"fulfilled_by_user_id" varchar(255),
	"last_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_profiles" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"gender" varchar(100),
	"location" varchar(255),
	"contact_notes" varchar(500),
	"avatar_url" varchar(2000),
	"deactivated_at" timestamp with time zone,
	"identity_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"link_to" varchar(2000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_authors" ADD CONSTRAINT "book_authors_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_authors" ADD CONSTRAINT "book_authors_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_categories" ADD CONSTRAINT "book_categories_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_categories" ADD CONSTRAINT "book_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_copies" ADD CONSTRAINT "collection_copies_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_copies" ADD CONSTRAINT "collection_copies_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_events" ADD CONSTRAINT "copy_events_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_images" ADD CONSTRAINT "copy_images_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_loans" ADD CONSTRAINT "copy_loans_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_loans" ADD CONSTRAINT "copy_loans_counterparty_user_id_member_profiles_user_id_fk" FOREIGN KEY ("counterparty_user_id") REFERENCES "public"."member_profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editions" ADD CONSTRAINT "editions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_entity_refs" ADD CONSTRAINT "import_entity_refs_run_id_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."import_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_run_payloads" ADD CONSTRAINT "import_run_payloads_run_id_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_quotes" ADD CONSTRAINT "book_quotes_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_fulfilled_by_copy_id_copies_id_fk" FOREIGN KEY ("fulfilled_by_copy_id") REFERENCES "public"."copies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "copy_loans_user_id_idx" ON "copy_loans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "copy_loans_copy_id_idx" ON "copy_loans" USING btree ("copy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "copy_loans_active_copy_idx" ON "copy_loans" USING btree ("copy_id") WHERE "copy_loans"."returned_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "import_entity_refs_entity_source_ref_unique" ON "import_entity_refs" USING btree ("entity_type","source_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "import_run_payloads_run_entity_source_ref_unique" ON "import_run_payloads" USING btree ("run_id","entity_type","source_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "wishes_user_book_active_unique" ON "wishes" USING btree ("user_id","book_id") WHERE "wishes"."status" = 'active';--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_created_idx" ON "notifications" USING btree ("user_id","read","created_at");