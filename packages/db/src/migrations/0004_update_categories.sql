-- Drop dependent bridge table first
DROP TABLE IF EXISTS "book_categories";

-- Then drop categories
DROP TABLE IF EXISTS "categories";

-- Recreate categories with Thema-based primary key
CREATE TABLE "categories" (
  "thema_code" varchar(20) PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Recreate many-to-many bridge
CREATE TABLE "book_categories" (
  "book_id" uuid NOT NULL,
  "thema_code" varchar(20) NOT NULL,
  CONSTRAINT "book_categories_book_id_thema_code_pk"
    PRIMARY KEY ("book_id", "thema_code"),
  CONSTRAINT "book_categories_book_id_books_id_fk"
    FOREIGN KEY ("book_id")
    REFERENCES "books"("id")
    ON DELETE CASCADE,
  CONSTRAINT "book_categories_thema_code_categories_thema_code_fk"
    FOREIGN KEY ("thema_code")
    REFERENCES "categories"("thema_code")
    ON DELETE CASCADE
);