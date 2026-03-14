import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import JSZip from "jszip";
import { parseZipFile } from "../zip";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    await rm(dir, { recursive: true, force: true });
  }
});

async function writeZip(entries: Array<{ path: string; content: string | Buffer }>) {
  const dir = await mkdtemp(join(tmpdir(), "importer-zip-test-"));
  tempDirs.push(dir);
  const zipPath = join(dir, "import.zip");

  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.path, entry.content);
  }
  const bytes = await zip.generateAsync({ type: "nodebuffer" });
  await writeFile(zipPath, bytes);
  return zipPath;
}

describe("parseZipFile", () => {
  test("accepts nested covers path and ignores common macOS metadata files", async () => {
    const zipPath = await writeZip([
      {
        path: "seed/books.csv",
        content:
          "id,title,subtitle,language,author_names,category_slugs\nbook_1,Book One,,en,Author One,fiction",
      },
      {
        path: "seed/editions.csv",
        content:
          "id,book_id,isbn,format,description,publisher,published_year,page_count,verification_override_note\nedition_1,book_1,9780306406157,paperback,,Pub,1980,200,",
      },
      {
        path: "seed/covers/9780306406157.png",
        content: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      },
      { path: "__MACOSX/._books.csv", content: "metadata" },
      { path: "seed/.DS_Store", content: "metadata" },
      { path: "seed/covers/.DS_Store", content: "metadata" },
    ]);

    const parsed = await parseZipFile(zipPath, { mode: "catalog" });
    expect(parsed.files["books.csv"].present).toBe(true);
    expect(parsed.files["editions.csv"].present).toBe(true);
    expect(parsed.files["copies.csv"].present).toBe(false);
    expect(parsed.files["wishes.csv"].present).toBe(false);
    expect(parsed.covers).toHaveLength(1);
    expect(parsed.covers[0]?.isbn).toBe("9780306406157");
    expect(parsed.covers[0]?.zipPath).toBe("seed/covers/9780306406157.png");
  });

  test("accepts standard import zip with only copies.csv", async () => {
    const zipPath = await writeZip([
      {
        path: "copies.csv",
        content:
          "id,edition_isbn,email,condition,notes,share_type,contact_note,status\ncopy_1,9780306406157,user@bookshare.local,good,,lend,,available",
      },
    ]);

    const parsed = await parseZipFile(zipPath, { mode: "catalog" });
    expect(parsed.files["copies.csv"].present).toBe(true);
    expect(parsed.files["wishes.csv"].present).toBe(false);
    expect(parsed.files["books.csv"].present).toBe(false);
    expect(parsed.files["editions.csv"].present).toBe(false);
    expect(parsed.covers).toHaveLength(0);
  });

  test("rejects standard import zip when only books.csv is included", async () => {
    const zipPath = await writeZip([
      {
        path: "books.csv",
        content: "id,title,subtitle,language,author_names,category_slugs\n",
      },
    ]);

    await expect(parseZipFile(zipPath, { mode: "catalog" })).rejects.toThrow(
      "Catalog ZIP must include both books.csv and editions.csv together"
    );
  });

  test("rejects standard import zip with covers but no catalog files", async () => {
    const zipPath = await writeZip([
      {
        path: "copies.csv",
        content:
          "id,edition_isbn,email,condition,notes,share_type,contact_note,status\ncopy_1,9780306406157,user@bookshare.local,good,,lend,,available",
      },
      {
        path: "covers/9780306406157.png",
        content: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      },
    ]);

    await expect(parseZipFile(zipPath, { mode: "catalog" })).rejects.toThrow(
      "Catalog ZIP must not include covers/ unless books.csv and editions.csv are included"
    );
  });

  test("accepts inventory-only zip with only copies.csv", async () => {
    const zipPath = await writeZip([
      {
        path: "copies.csv",
        content:
          "id,edition_isbn,email,condition,notes,share_type,contact_note,status\ncopy_1,9780306406157,user@bookshare.local,good,,lend,,available",
      },
    ]);

    const parsed = await parseZipFile(zipPath, { mode: "inventory_only" });
    expect(parsed.files["copies.csv"].present).toBe(true);
    expect(parsed.files["wishes.csv"].present).toBe(false);
    expect(parsed.files["books.csv"].present).toBe(false);
    expect(parsed.files["editions.csv"].present).toBe(false);
    expect(parsed.covers).toHaveLength(0);
  });

  test("rejects inventory-only zip when books.csv is included", async () => {
    const zipPath = await writeZip([
      { path: "books.csv", content: "id,title,subtitle,language,author_names,category_slugs\n" },
      {
        path: "copies.csv",
        content:
          "id,edition_isbn,email,condition,notes,share_type,contact_note,status\ncopy_1,9780306406157,user@bookshare.local,good,,lend,,available",
      },
    ]);

    await expect(
      parseZipFile(zipPath, { mode: "inventory_only" })
    ).rejects.toThrow("Inventory-only ZIP must not include books.csv or editions.csv");
  });
});
