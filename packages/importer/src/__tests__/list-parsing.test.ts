import { describe, expect, test } from "bun:test";
import { parseCategorySlugs, parseDelimitedUniqueList } from "../list-parsing";

describe("list parsing helpers", () => {
  test("parses and deduplicates delimited list values", () => {
    expect(parseDelimitedUniqueList("Alice; Bob ; Alice")).toEqual([
      "Alice",
      "Bob",
    ]);
    expect(parseDelimitedUniqueList("a|b|a")).toEqual(["a", "b"]);
    expect(parseDelimitedUniqueList("a,b,a")).toEqual(["a", "b"]);
  });

  test("normalizes and deduplicates category slugs", () => {
    expect(parseCategorySlugs("Fiction;Classics;fiction")).toEqual([
      "fiction",
      "classics",
    ]);
  });
});
