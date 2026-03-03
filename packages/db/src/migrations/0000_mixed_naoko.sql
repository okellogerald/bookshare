CREATE TYPE "public"."acquisition_type" AS ENUM('purchased', 'donated', 'consigned', 'other');--> statement-breakpoint
CREATE TYPE "public"."copy_condition" AS ENUM('new', 'like_new', 'good', 'fair', 'poor');--> statement-breakpoint
CREATE TYPE "public"."copy_status" AS ENUM('available', 'reserved', 'rented', 'checked_out', 'sold', 'donated', 'given_away', 'lost', 'damaged');--> statement-breakpoint
CREATE TYPE "public"."share_type" AS ENUM('lend', 'sell', 'give_away');--> statement-breakpoint
CREATE TYPE "public"."copy_event_type" AS ENUM('acquired', 'status_change', 'condition_change', 'sold', 'rented', 'returned', 'donated', 'given_away', 'lost', 'damaged', 'note_added');--> statement-breakpoint
CREATE TYPE "public"."book_format" AS ENUM('hardcover', 'paperback', 'mass_market', 'ebook', 'audiobook');--> statement-breakpoint
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
	"description" text,
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
	"acquisition_type" "acquisition_type" NOT NULL,
	"acquisition_date" timestamp with time zone,
	"location" varchar(500),
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
	"amount" numeric(12, 2),
	"currency" varchar(3),
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"isbn" varchar(20),
	"format" "book_format" NOT NULL,
	"publisher" varchar(500),
	"published_year" integer,
	"page_count" integer,
	"cover_image_url" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editions_isbn_unique" UNIQUE("isbn")
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
CREATE TABLE "wants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"book_id" uuid NOT NULL,
	"notes" text,
	"last_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wants_user_book_unique" UNIQUE("user_id","book_id")
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
ALTER TABLE "editions" ADD CONSTRAINT "editions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_quotes" ADD CONSTRAINT "book_quotes_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wants" ADD CONSTRAINT "wants_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;