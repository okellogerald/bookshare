import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveValidateZipSelection } from "../zip-input";

const tempDirs: string[] = [];

afterEach(async () => {
  delete process.env.IMPORTER_INPUT_DIR;

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    await rm(dir, { recursive: true, force: true });
  }
});

async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "importer-input-test-"));
  tempDirs.push(dir);
  return dir;
}

describe("resolveValidateZipSelection", () => {
  test("returns explicit --zip path as-is", async () => {
    const selected = await resolveValidateZipSelection("/tmp/custom.zip");
    expect(selected.zipPath).toBe("/tmp/custom.zip");
    expect(selected.selectedFromInputFolder).toBe(false);
    expect(selected.inputFolderPath).toBeNull();
  });

  test("auto-selects newest zip from IMPORTER_INPUT_DIR", async () => {
    const dir = await createTempDir();
    process.env.IMPORTER_INPUT_DIR = dir;

    const olderZip = join(dir, "older.zip");
    const newerZip = join(dir, "newer.zip");
    await writeFile(olderZip, Buffer.from("zip-1"));
    await writeFile(newerZip, Buffer.from("zip-2"));
    await utimes(olderZip, new Date(1_000), new Date(1_000));
    await utimes(newerZip, new Date(2_000), new Date(2_000));

    const selected = await resolveValidateZipSelection(undefined);
    expect(selected.selectedFromInputFolder).toBe(true);
    expect(selected.inputFolderPath).toBe(dir);
    expect(selected.zipPath).toBe(newerZip);
  });

  test("fails when input folder has no zip files", async () => {
    const dir = await createTempDir();
    process.env.IMPORTER_INPUT_DIR = dir;
    await writeFile(join(dir, "notes.txt"), "not a zip");

    await expect(resolveValidateZipSelection(undefined)).rejects.toThrow(
      `No .zip files found in input folder '${dir}'. Add a ZIP there or pass --zip <path>.`
    );
  });
});
