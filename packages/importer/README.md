# Importer CLI

Atomic CSV ingestion tool for BookTrack.

## Commands

```bash
bun run import:validate --zip /path/to/import.zip --actor your_username
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
`source_ref,title,subtitle,description,language,author_names`

### `editions.csv`
`source_ref,book_ref,isbn,format,publisher,published_year,page_count,verification_override_note`

### `copies.csv`
`source_ref,edition_isbn,username,condition,notes,share_type,contact_note,status`

### `wants.csv`
`source_ref,edition_isbn,username,notes`

## Validation Highlights

- Strict create-only mode (`source_ref` collisions in history are rejected).
- ISBNs are normalized to digits/`X`, must be 10 or 13 chars, and must pass checksum.
- Every imported book must have at least one imported ISBN edition.
- Usernames in `copies.csv` / `wants.csv` must exist in `member_profiles`.
- `book_ref` and `edition_isbn` links are resolved deterministically.
- Existing edition ISBNs and existing active wants are treated as conflicts.

## Commit Behavior

- Commit reads only persisted validated payloads for the given run.
- Writes happen in one DB transaction:
  - books
  - editions
  - copies (+ acquired events)
  - wants
  - import entity refs
- Any failure rolls back the whole transaction.
