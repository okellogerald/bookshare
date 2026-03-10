import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { describe, expect, test } from "bun:test";
import { categories, createDb, memberProfiles } from "@bookshare/db";
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

function parsedInputFor(params: {
  categorySlugs: string;
  coverImageUrl: string;
}): ParsedZipInput {
  return {
    zipName: "integration.zip",
    sha256: "0".repeat(64),
    files: {
      "books.csv": {
        fileName: "books.csv",
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
        headers: [
          "id",
          "book_id",
          "isbn",
          "format",
          "description",
          "publisher",
          "published_year",
          "page_count",
          "cover_image_url",
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
            cover_image_url: params.coverImageUrl,
            verification_override_note: "",
          },
        ],
      },
      "copies.csv": {
        fileName: "copies.csv",
        headers: [
          "id",
          "edition_id",
          "username",
          "condition",
          "notes",
          "share_type",
          "contact_note",
          "status",
        ],
        rows: [],
      },
      "wants.csv": {
        fileName: "wants.csv",
        headers: ["id", "edition_id", "username", "notes"],
        rows: [],
      },
    },
  };
}

describe("importer validation integration", () => {
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
          coverImageUrl: "https://example.com/cover.jpg",
        }),
        actorUsername
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

  integrationTest("fails invalid cover_image_url before attempting storage", async () => {
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
          coverImageUrl: "ftp://example.com/not-allowed.jpg",
        }),
        actorUsername
      );

      expect(result.status).toBe("invalid");
      expect(
        result.summary.issues.some((issue) => issue.code === "invalid_cover_image_url")
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

      const pngBytes = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgQxXHzUAAAAASUVORK5CYII=",
        "base64"
      );

      const server = createServer((_, res) => {
        res.writeHead(200, {
          "Content-Type": "image/png",
          "Content-Length": String(pngBytes.length),
        });
        res.end(pngBytes);
      });

      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        throw new Error("Failed to bind local HTTP server for cover image test");
      }
      const coverImageUrl = `http://127.0.0.1:${address.port}/cover.png`;

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
            coverImageUrl,
          }),
          actorUsername
        );

        expect(result.status).toBe("validated");
        expect(result.payloads.editions).toHaveLength(1);
        expect(result.payloads.editions[0]!.coverImageUrl).toContain(
          "/edition-covers/9780306406157.png"
        );
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
        await db.delete(categories).where(eq(categories.slug, categorySlug));
        await db
          .delete(memberProfiles)
          .where(eq(memberProfiles.userId, actorUserId));
      }
    }
  );
});
