import { describe, expect, test } from "bun:test";
import { summaryIssuesToCsv } from "../reporter";
import type { ImportSummary } from "../types";

describe("summaryIssuesToCsv", () => {
  test("renders CSV header and issue rows", () => {
    const summary: ImportSummary = {
      totalRows: 2,
      validRows: 1,
      issueCount: 1,
      files: {
        "books.csv": { rowCount: 1 },
        "editions.csv": { rowCount: 1 },
        "copies.csv": { rowCount: 0 },
        "wants.csv": { rowCount: 0 },
      },
      issues: [
        {
          file: "editions.csv",
          rowNumber: 3,
          column: "isbn",
          sourceRef: "edition_001",
          code: "invalid_isbn_checksum",
          message: "Checksum failed",
        },
      ],
    };

    const csv = summaryIssuesToCsv(summary);
    expect(csv).toContain("file,row_number,column,id,code,message");
    expect(csv).toContain(
      "editions.csv,3,isbn,edition_001,invalid_isbn_checksum,Checksum failed"
    );
  });
});
