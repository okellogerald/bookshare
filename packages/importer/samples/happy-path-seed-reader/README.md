# Happy Path Sample (seed_reader)

This sample matches the current CSV contract:
- books.csv
- editions.csv
- copies.csv
- wants.csv

## Use

```bash
cd /Users/mac/Desktop/Projects/library
zip -j /tmp/import-happy-path.zip packages/importer/samples/happy-path-seed-reader/*.csv
bun run import:validate --zip /tmp/import-happy-path.zip --actor seed_reader
bun run import:commit --run-id <RUN_ID_FROM_VALIDATE>
```

## Notes

- Usernames must already exist in `member_profiles`.
- `id` is create-only across runs. If you re-run this sample after a successful commit, change all `id` values first.
