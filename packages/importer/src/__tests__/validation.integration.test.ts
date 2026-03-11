import { randomUUID } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  books,
  categories,
  createDb,
  editions,
  memberProfiles,
  wants,
} from "@bookshare/db";
import { eq } from "drizzle-orm";
import { validateParsedInput } from "../validation";
import type { ParsedZipInput } from "../types";

const databaseUrl = process.env.DATABASE_URL;
const shouldRunIntegration =
  Boolean(databaseUrl) && process.env.RUN_IMPORTER_INTEGRATION_TESTS === "1";
const integrationTest = shouldRunIntegration ? test : test.skip;
const shouldRunMinioIntegration =
  shouldRunIntegration && process.env.RUN_IMPORTER_MINIO_INTEGRATION_TESTS === "1";
const minioIntegrationTest = shouldRunMinioIntegration ? test : test.skip;

function isbn13FromPrefix12(prefix12: string): string {
  const digits = prefix12.replace(/\D/g, "");
  if (digits.length !== 12) {
    throw new Error(`ISBN-13 prefix must contain exactly 12 digits (received '${prefix12}')`);
  }

  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const digit = Number.parseInt(digits[index]!, 10);
    sum += index % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${digits}${checkDigit}`;
}

function parsedInputFor(params: {
  categorySlugs: string;
  includeCover: boolean;
}): ParsedZipInput {
  const pngBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgQxXHzUAAAAASUVORK5CYII=",
    "base64"
  );

  return {
    zipName: "integration.zip",
    sha256: "0".repeat(64),
    mode: "catalog",
    files: {
      "books.csv": {
        fileName: "books.csv",
        present: true,
        headers: [
          "id",
          "title",
          "subtitle",
          "language",
          "author_names",
          "category_slugs",
        ],
        rows: [
          {
            id: "book_1",
            title: "Integration Book",
            subtitle: "",
            language: "en",
            author_names: "Author One",
            category_slugs: params.categorySlugs,
          },
        ],
      },
      "editions.csv": {
        fileName: "editions.csv",
        present: true,
        headers: [
          "id",
          "book_id",
          "isbn",
          "format",
          "description",
          "publisher",
          "published_year",
          "page_count",
          "verification_override_note",
        ],
        rows: [
          {
            id: "edition_1",
            book_id: "book_1",
            isbn: "9780306406157",
            format: "paperback",
            description: "",
            publisher: "",
            published_year: "1980",
            page_count: "240",
            verification_override_note: "",
          },
        ],
      },
      "copies.csv": {
        fileName: "copies.csv",
        present: false,
        headers: [],
        rows: [],
      },
      "wants.csv": {
        fileName: "wants.csv",
        present: false,
        headers: [],
        rows: [],
      },
    },
    covers: params.includeCover
      ? [
          {
            zipPath: "covers/9780306406157.png",
            fileName: "9780306406157.png",
            isbn: "9780306406157",
            extension: "png",
            bytes: pngBytes,
          },
        ]
      : [],
  };
}

describe("importer validation integration", () => {
  integrationTest(
    "fails when an active want already exists for the same user/book",
    async () => {
      if (!databaseUrl) return;
      const db = createDb(databaseUrl);
      const suffix = randomUUID().slice(0, 8);
      const actorUserId = `it_validate_actor_${suffix}`;
      const actorEmail = `${actorUserId}@bookshare.local`;
      const suffixDigits = suffix.replace(/\D/g, "").padEnd(4, "7").slice(0, 4);
      const isbn = isbn13FromPrefix12(`97803064${suffixDigits}`);

      let bookId = "";
      let editionId = "";

      try {
        await db.insert(memberProfiles).values({
          userId: actorUserId,
          username: actorUserId,
          email: actorEmail,
          displayName: "Importer Validation Actor",
        });

        const [createdBook] = await db
          .insert(books)
          .values({
            title: `Existing Want Book ${suffix}`,
            subtitle: null,
            language: "en",
          })
          .returning({ id: books.id });
        bookId = createdBook!.id;

        const [createdEdition] = await db
          .insert(editions)
          .values({
            bookId,
            isbn,
            format: "paperback",
            description: null,
            publisher: null,
            publishedYear: null,
            pageCount: null,
            coverImageUrl: null,
          })
          .returning({ id: editions.id });
        editionId = createdEdition!.id;

        await db.insert(wants).values({
          userId: actorUserId,
          bookId,
          editionId,
          status: "active",
          notes: "existing want",
        });

        const parsed: ParsedZipInput = {
          zipName: "integration-inventory.zip",
          sha256: "0".repeat(64),
          mode: "inventory_only",
          files: {
            "books.csv": {
              fileName: "books.csv",
              present: false,
              headers: [],
              rows: [],
            },
            "editions.csv": {
              fileName: "editions.csv",
              present: false,
              headers: [],
              rows: [],
            },
            "copies.csv": {
              fileName: "copies.csv",
              present: false,
              headers: [],
              rows: [],
            },
            "wants.csv": {
              fileName: "wants.csv",
              present: true,
              headers: ["id", "edition_isbn", "email", "notes"],
              rows: [
                {
                  id: "want_new_1",
                  edition_isbn: isbn,
                  email: actorEmail,
                  notes: "new want from import",
                },
              ],
            },
          },
          covers: [],
        };

        const result = await validateParsedInput(db, parsed, actorEmail, {
          mode: "inventory_only",
          replaceInventory: false,
        });

        expect(result.status).toBe("invalid");
        expect(
          result.summary.issues.some(
            (issue) => issue.code === "active_want_already_exists"
          )
        ).toBe(true);
      } finally {
        await db.delete(wants).where(eq(wants.userId, actorUserId));
        if (editionId) {
          await db.delete(editions).where(eq(editions.id, editionId));
        }
        if (bookId) {
          await db.delete(books).where(eq(books.id, bookId));
        }
        await db
          .delete(memberProfiles)
          .where(eq(memberProfiles.userId, actorUserId));
      }
    }
  );

  integrationTest("fails unknown category slug and skips cover upload side effects", async () => {
    if (!databaseUrl) return;
    const db = createDb(databaseUrl);
    const suffix = randomUUID().slice(0, 8);
    const actorUserId = `it_validate_actor_${suffix}`;
    const actorUsername = `it_validate_actor_${suffix}`;

    try {
      await db.insert(memberProfiles).values({
        userId: actorUserId,
        username: actorUsername,
        email: `${actorUsername}@bookshare.local`,
        displayName: "Importer Validation Actor",
      });

      const result = await validateParsedInput(
        db,
        parsedInputFor({
          categorySlugs: "missing-category",
          includeCover: true,
        }),
        actorUsername,
        { mode: "catalog", replaceInventory: false }
      );

      expect(result.status).toBe("invalid");
      expect(
        result.summary.issues.some((issue) => issue.code === "unknown_category_slug")
      ).toBe(true);
      expect(
        result.summary.issues.some(
          (issue) => issue.code === "cover_storage_config_missing"
        )
      ).toBe(false);
    } finally {
      await db
        .delete(memberProfiles)
        .where(eq(memberProfiles.userId, actorUserId));
    }
  });

  integrationTest("fails when no cover file matches edition ISBN", async () => {
    if (!databaseUrl) return;
    const db = createDb(databaseUrl);
    const suffix = randomUUID().slice(0, 8);
    const actorUserId = `it_validate_actor_${suffix}`;
    const actorUsername = `it_validate_actor_${suffix}`;
    const categorySlug = `it-validate-category-${suffix}`;

    try {
      await db.insert(memberProfiles).values({
        userId: actorUserId,
        username: actorUsername,
        email: `${actorUsername}@bookshare.local`,
        displayName: "Importer Validation Actor",
      });
      await db.insert(categories).values({
        name: `Validate Category ${suffix}`,
        slug: categorySlug,
      });

      const result = await validateParsedInput(
        db,
        parsedInputFor({
          categorySlugs: categorySlug,
          includeCover: false,
        }),
        actorUsername,
        { mode: "catalog", replaceInventory: false }
      );

      expect(result.status).toBe("invalid");
      expect(
        result.summary.issues.some(
          (issue) => issue.code === "missing_cover_file_for_isbn"
        )
      ).toBe(true);
      expect(
        result.summary.issues.some(
          (issue) => issue.code === "cover_storage_config_missing"
        )
      ).toBe(false);
    } finally {
      await db.delete(categories).where(eq(categories.slug, categorySlug));
      await db
        .delete(memberProfiles)
        .where(eq(memberProfiles.userId, actorUserId));
    }
  });

  minioIntegrationTest(
    "uploads cover image and stores MinIO URL on successful validation",
    async () => {
      if (!databaseUrl) return;
      const db = createDb(databaseUrl);
      const suffix = randomUUID().slice(0, 8);
      const actorUserId = `it_validate_actor_${suffix}`;
      const actorUsername = `it_validate_actor_${suffix}`;
      const categorySlug = `it-validate-category-${suffix}`;

      try {
        await db.insert(memberProfiles).values({
          userId: actorUserId,
          username: actorUsername,
          email: `${actorUsername}@bookshare.local`,
          displayName: "Importer Validation Actor",
        });
        await db.insert(categories).values({
          name: `Validate Category ${suffix}`,
          slug: categorySlug,
        });

        const result = await validateParsedInput(
          db,
          parsedInputFor({
            categorySlugs: categorySlug,
            includeCover: true,
          }),
          actorUsername,
          { mode: "catalog", replaceInventory: false }
        );

        expect(result.status).toBe("validated");
        expect(result.payloads.editions).toHaveLength(1);
        expect(result.payloads.editions[0]!.coverImageUrl).toContain(
          "/edition-covers/9780306406157.png"
        );
      } finally {
        await db.delete(categories).where(eq(categories.slug, categorySlug));
        await db
          .delete(memberProfiles)
          .where(eq(memberProfiles.userId, actorUserId));
      }
    }
  );
});
