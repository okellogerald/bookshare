# Importer CLI

Atomic CSV ingestion tool for Bookshare.

## Commands

```bash
bun run import:validate --actor admin@your-org.local
bun run import:validate --actor admin@your-org.local --inventory-only --replace-inventory
bun run import:validate --zip /path/to/import.zip --actor admin@your-org.local
bun run import:commit --run-id <run-id>
bun run import:report --run-id <run-id> --format json
bun run import:report --run-id <run-id> --format csv
```

The `validate` command exits with code `2` when validation fails.

If `--zip` is omitted, the importer auto-selects the newest `.zip` file from:
- `IMPORTER_INPUT_DIR` (if set), otherwise
- `packages/importer/input`

## ZIP Contract

### Standard Import (default)

Allowed combinations:
- `books.csv` + `editions.csv` + `covers/`
- `books.csv` + `editions.csv` + `covers/` + `copies.csv`
- `books.csv` + `editions.csv` + `covers/` + `wishes.csv`
- `books.csv` + `editions.csv` + `covers/` + `copies.csv` + `wishes.csv`
- `copies.csv`
- `wishes.csv`
- `copies.csv` + `wishes.csv`

Rules:
- `books.csv` and `editions.csv` must be provided together.
- `covers/` is required when `editions.csv` is included.
- `covers/` must not be included when `books.csv` and `editions.csv` are absent.
- `copies.csv` and `wishes.csv` may reference editions imported in the same ZIP or editions that already exist in the database.

### Inventory-Only Import (`--inventory-only`)

Required:
- At least one of `copies.csv` or `wishes.csv`

Must not include:
- `books.csv`
- `editions.csv`
- `covers/`

Use `--replace-inventory` with `--inventory-only` to clear all existing `copies` and `wishes` before importing new inventory rows.

## CSV Contract

### `books.csv`
`id,title,subtitle,language,author_names,category_slugs`

### `editions.csv`
`id,book_id,isbn,format,description,publisher,published_year,page_count,verification_override_note`

### `copies.csv`
`id,edition_isbn,email,condition,notes,share_type,contact_note,status`

### `wishes.csv`
`id,edition_isbn,email,notes`

## Validation Highlights

- Strict create-only mode on `id` by entity (unless `--replace-inventory` for copies/wishes).
- ISBNs normalize to digits/`X`, must be 10 or 13 chars, and must pass checksum.
- Every imported book must have at least one imported ISBN edition.
- `category_slugs` is required for every book and each slug must already exist in `categories`.
- Every imported edition must have exactly one matching cover file in `covers/` by ISBN.
- Cover files are uploaded to MinIO as `edition-covers/<normalized-isbn>.<ext>`.
- `--actor` resolves strictly against `member_profiles.email`.
- `copies.csv` / `wishes.csv` resolve users strictly against `member_profiles.email`.
- `edition_isbn` in copies/wishes can reference imported editions or existing DB editions.
- Wants are validated against active uniqueness (`user + book`) in-batch and against existing DB wishes.

## Commit Behavior

- Commit reads only persisted validated payloads for the run.
- Writes happen in one DB transaction:
  - books
  - editions
  - book_categories
  - copies (+ listed events)
  - wishes
  - import entity refs
- For inventory replacement runs, `wishes`, `copies`, and their import refs are cleared first in the same transaction.
- Any DB failure rolls back the whole transaction.

## Environment

`validate` requires:

- `DATABASE_URL`
- `MINIO_ENDPOINT`
- `MINIO_PORT` (required only when `MINIO_ENDPOINT` does not already include a port)
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`
- `PUBLIC_MINIO_URL` (optional, defaults to MinIO endpoint URL)
