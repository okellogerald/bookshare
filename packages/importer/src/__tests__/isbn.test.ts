import { describe, expect, test } from "bun:test";
import { isValidIsbn, normalizeIsbn } from "../isbn";

describe("ISBN helpers", () => {
  test("normalizes punctuation and spaces", () => {
    expect(normalizeIsbn("978-0-13-235088-4")).toBe("9780132350884");
  });

  test("validates ISBN-13 checksums", () => {
    expect(isValidIsbn("9780132350884")).toBe(true);
    expect(isValidIsbn("9780132350885")).toBe(false);
  });

  test("validates ISBN-10 checksums including X", () => {
    expect(isValidIsbn("0132350882")).toBe(true);
    expect(isValidIsbn("048665088X")).toBe(true);
    expect(isValidIsbn("0132350881")).toBe(false);
  });
});
