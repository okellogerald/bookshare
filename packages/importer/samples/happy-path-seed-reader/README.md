# Happy Path Sample (seed_reader)

This sample matches the current CSV contract:
- books.csv
- editions.csv
- copies.csv (optional)
- wishes.csv (optional)
- covers/ (required for catalog imports)

## Use

```bash
cd /Users/mac/Desktop/Projects/library
zip -r /tmp/import-happy-path.zip packages/importer/samples/happy-path-seed-reader
cp /tmp/import-happy-path.zip packages/importer/input/
bun run import:validate --actor seed_reader@bookshare.local
bun run import:commit --run-id <RUN_ID_FROM_VALIDATE>
```

## Notes

- Emails in `copies.csv` and `wishes.csv` must already exist in `member_profiles.email`.
- Category slugs in `books.csv` must already exist in `categories` (BISAC slugs).
- Cover files in `covers/` must be named `<isbn>.<ext>` and match ISBNs in `editions.csv`.
- Cover images are uploaded to MinIO using ISBN-based object keys.
- `id` is create-only across runs. If you re-run this sample after a successful commit, change all `id` values first.
