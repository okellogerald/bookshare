# Importer CLI

Atomic CSV ingestion tool for Bookshare.

## Commands

```bash
bun run import:validate --zip /path/to/import.zip --actor admin@your-org.local
bun run import:commit --run-id <run-id>
bun run import:report --run-id <run-id> --format json
bun run import:report --run-id <run-id> --format csv
```

The `validate` command exits with code `2` when validation fails.

## Required ZIP Contents

The ZIP must contain exactly these files:

- `books.csv`
- `editions.csv`
- `copies.csv`
- `wants.csv`

## CSV Contract

### `books.csv`
`id,title,subtitle,description,language,author_names,category_slugs`

### `editions.csv`
`id,book_id,isbn,format,publisher,published_year,page_count,cover_image_url,verification_override_note`

### `copies.csv`
`id,edition_id,username,condition,notes,share_type,contact_note,status`

### `wants.csv`
`id,edition_id,username,notes`

## Validation Highlights

- Strict create-only mode (`id` collisions in history are rejected).
- ISBNs are normalized to digits/`X`, must be 10 or 13 chars, and must pass checksum.
- Every imported book must have at least one imported ISBN edition.
- `category_slugs` is required on every book and each slug must already exist in `categories` (BISAC slugs in this project).
- `cover_image_url` is required on every edition, must be a reachable `http/https` image URL (`jpeg/png/webp`, <= 5MB).
- Cover images are stored in MinIO at deterministic keys: `edition-covers/<normalized-isbn>.<ext>`.
- `--actor` resolves against `member_profiles.email` (preferred) or `member_profiles.username`.
- `copies.csv` / `wants.csv` user identifiers resolve against `member_profiles.email` (preferred) or `member_profiles.username`.
- `book_id` and `edition_id` links are resolved deterministically.
- Existing edition ISBNs and existing active wants are treated as conflicts.

## Commit Behavior

- Commit reads only persisted validated payloads for the given run.
- Writes happen in one DB transaction:
  - books
  - editions
  - book_categories
  - copies (+ acquired events)
  - wants
  - import entity refs
- Any failure rolls back the whole transaction.

## Environment

`validate` requires:

- `DATABASE_URL`
- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`
- `PUBLIC_MINIO_URL` (optional, defaults to MinIO endpoint URL)
