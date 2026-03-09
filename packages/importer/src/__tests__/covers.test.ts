import { describe, expect, test } from "bun:test";
import {
  buildEditionCoverObjectKey,
  extensionForContentType,
  parseCoverSourceUrl,
} from "../covers";

describe("cover helpers", () => {
  test("accepts only http/https source URLs", () => {
    expect(parseCoverSourceUrl("https://example.com/cover.jpg")).not.toBeNull();
    expect(parseCoverSourceUrl("http://example.com/cover.png")).not.toBeNull();
    expect(parseCoverSourceUrl("ftp://example.com/cover.jpg")).toBeNull();
    expect(parseCoverSourceUrl("/relative/path.jpg")).toBeNull();
  });

  test("maps supported content-types to extensions", () => {
    expect(extensionForContentType("image/jpeg")).toBe("jpg");
    expect(extensionForContentType("image/png; charset=binary")).toBe("png");
    expect(extensionForContentType("image/webp")).toBe("webp");
    expect(extensionForContentType("text/html")).toBeNull();
  });

  test("builds ISBN-based cover object keys", () => {
    expect(buildEditionCoverObjectKey("978-0-13-235088-4", "jpg")).toBe(
      "edition-covers/9780132350884.jpg"
    );
  });
});
