CREATE TYPE "public"."import_entity_type" AS ENUM('books', 'editions', 'copies', 'wants');--> statement-breakpoint
CREATE TYPE "public"."import_run_status" AS ENUM('invalid', 'validated', 'committed');--> statement-breakpoint
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
ALTER TABLE "import_entity_refs" ADD CONSTRAINT "import_entity_refs_run_id_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."import_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_run_payloads" ADD CONSTRAINT "import_run_payloads_run_id_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_entity_refs_entity_source_ref_unique" ON "import_entity_refs" USING btree ("entity_type","source_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "import_run_payloads_run_entity_source_ref_unique" ON "import_run_payloads" USING btree ("run_id","entity_type","source_ref");
