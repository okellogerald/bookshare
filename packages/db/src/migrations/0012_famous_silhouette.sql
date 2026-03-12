ALTER TYPE "public"."want_status" RENAME TO "wish_status";--> statement-breakpoint
ALTER TABLE "wants" RENAME TO "wishes";--> statement-breakpoint
ALTER TABLE "wishes" DROP CONSTRAINT "wants_book_id_books_id_fk";
--> statement-breakpoint
ALTER TABLE "wishes" DROP CONSTRAINT "wants_edition_id_editions_id_fk";
--> statement-breakpoint
ALTER TABLE "wishes" DROP CONSTRAINT "wants_fulfilled_by_copy_id_copies_id_fk";
--> statement-breakpoint
DROP INDEX "wants_user_book_active_unique";--> statement-breakpoint
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_fulfilled_by_copy_id_copies_id_fk" FOREIGN KEY ("fulfilled_by_copy_id") REFERENCES "public"."copies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wishes_user_book_active_unique" ON "wishes" USING btree ("user_id","book_id") WHERE "wishes"."status" = 'active';--> statement-breakpoint
ALTER TYPE "public"."import_entity_type" RENAME VALUE 'wants' TO 'wishes';
