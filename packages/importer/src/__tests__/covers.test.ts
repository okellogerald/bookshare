import { describe, expect, test } from "bun:test";
import {
  buildEditionCoverObjectKey,
  createEditionCoverStorageFromEnv,
  contentTypeForCoverExtension,
  coverExtensionFromFileName,
  normalizeCoverFileIsbn,
} from "../covers";

function withCoverEnv(values: Record<string, string | undefined>, fn: () => void) {
  const keys = Object.keys(values);
  const previous = new Map<string, string | undefined>();
  for (const key of keys) {
    previous.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    fn();
  } finally {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("cover helpers", () => {
  test("extracts supported cover extensions from file names", () => {
    expect(coverExtensionFromFileName("9780132350884.jpg")).toBe("jpg");
    expect(coverExtensionFromFileName("9780132350884.jpeg")).toBe("jpeg");
    expect(coverExtensionFromFileName("9780132350884.png")).toBe("png");
    expect(coverExtensionFromFileName("9780132350884.webp")).toBe("webp");
    expect(coverExtensionFromFileName("9780132350884.gif")).toBeNull();
  });

  test("normalizes ISBNs from cover file name stems", () => {
    expect(normalizeCoverFileIsbn("978-0-13-235088-4")).toBe("9780132350884");
    expect(normalizeCoverFileIsbn("0132350882")).toBe("0132350882");
    expect(normalizeCoverFileIsbn("not-an-isbn")).toBeNull();
  });

  test("maps cover extensions to content types", () => {
    expect(contentTypeForCoverExtension("jpg")).toBe("image/jpeg");
    expect(contentTypeForCoverExtension("jpeg")).toBe("image/jpeg");
    expect(contentTypeForCoverExtension("png")).toBe("image/png");
    expect(contentTypeForCoverExtension("webp")).toBe("image/webp");
  });

  test("builds ISBN-based cover object keys", () => {
    expect(buildEditionCoverObjectKey("978-0-13-235088-4", "jpg")).toBe(
      "edition-covers/9780132350884.jpg"
    );
  });

  test("accepts MINIO_ENDPOINT that already includes a port without MINIO_PORT", () => {
    withCoverEnv(
      {
        MINIO_ENDPOINT: "http://localhost:9002",
        MINIO_PORT: undefined,
        MINIO_ACCESS_KEY: "bookshare",
        MINIO_SECRET_KEY: "bookshare_dev",
        MINIO_BUCKET: "bookshare-media-dev",
      },
      () => {
        expect(() => createEditionCoverStorageFromEnv()).not.toThrow();
      }
    );
  });

  test("requires MINIO_PORT when MINIO_ENDPOINT has no embedded port", () => {
    withCoverEnv(
      {
        MINIO_ENDPOINT: "localhost",
        MINIO_PORT: undefined,
        MINIO_ACCESS_KEY: "bookshare",
        MINIO_SECRET_KEY: "bookshare_dev",
        MINIO_BUCKET: "bookshare-media-dev",
      },
      () => {
        expect(() => createEditionCoverStorageFromEnv()).toThrow(
          "MINIO_PORT is required for cover uploads when MINIO_ENDPOINT has no port"
        );
      }
    );
  });
});
