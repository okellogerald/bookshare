import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import JSZip from "jszip";
import { parseCsvHeaders, parseCsvRows } from "./csv";
import {
  coverExtensionFromFileName,
  normalizeCoverFileIsbn,
} from "./covers";
import {
  CSV_FILES,
  type CsvFileName,
  type ImportMode,
  type ParsedCoverFile,
  type ParsedCsvFile,
  type ParsedZipInput,
} from "./types";

export function sha256Hex(content: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(content)).digest("hex");
}

function assertCsvFileName(value: string): value is CsvFileName {
  return (CSV_FILES as readonly string[]).includes(value);
}

function emptyParsedCsv(fileName: CsvFileName): ParsedCsvFile {
  return {
    fileName,
    present: false,
    headers: [],
    rows: [],
  };
}

function isIgnoredZipPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.startsWith("__MACOSX/")) return true;
  const name = basename(normalized);
  if (name.startsWith("._")) return true;
  if (name === ".DS_Store") return true;
  return false;
}

function isCoverEntryPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return /(^|\/)covers\/[^/]+$/.test(normalized);
}

export async function parseZipFile(
  zipPath: string,
  options: { mode: ImportMode }
): Promise<ParsedZipInput> {
  let zipBuffer: ArrayBuffer;
  try {
    const raw = await readFile(zipPath);
    zipBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  } catch {
    throw new Error(`ZIP file does not exist or is not readable: ${zipPath}`);
  }

  const zip = await JSZip.loadAsync(zipBuffer);

  const csvFilesByName = new Map<CsvFileName, JSZip.JSZipObject>();
  const seenCsvNames = new Set<string>();
  const covers: ParsedCoverFile[] = [];

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const entryName = entry.name.replace(/\\/g, "/").trim();
    if (!entryName) continue;
    if (isIgnoredZipPath(entryName)) continue;

    if (isCoverEntryPath(entryName)) {
      const fileName = basename(entryName).trim();
      if (!fileName) continue;

      const extension = coverExtensionFromFileName(fileName);
      if (!extension) {
        throw new Error(
          `Invalid cover file '${entryName}'. Expected extension: .jpg, .jpeg, .png, .webp`
        );
      }

      const isbnPart = fileName.slice(0, fileName.length - extension.length - 1);
      const normalizedIsbn = normalizeCoverFileIsbn(isbnPart);
      if (!normalizedIsbn) {
        throw new Error(
          `Invalid cover file '${entryName}'. File name must be '<isbn>.<ext>' with a valid ISBN`
        );
      }

      const bytes = Buffer.from(await entry.async("uint8array"));
      covers.push({
        zipPath: entryName,
        fileName,
        isbn: normalizedIsbn,
        extension,
        bytes,
      });
      continue;
    }

    const name = basename(entryName).trim();
    if (!name) continue;

    if (!assertCsvFileName(name)) {
      throw new Error(
        `Unexpected file in ZIP: ${entryName}. Expected CSV files and optional covers/`
      );
    }

    if (seenCsvNames.has(name)) {
      throw new Error(`Duplicate CSV detected in ZIP: ${name}`);
    }

    seenCsvNames.add(name);
    csvFilesByName.set(name, entry);
  }

  if (options.mode === "catalog") {
    const missingRequired = ["books.csv", "editions.csv"].filter(
      (fileName) => !csvFilesByName.has(fileName as CsvFileName)
    );
    if (missingRequired.length > 0) {
      throw new Error(
        `ZIP is missing required CSV files: ${missingRequired.join(", ")}`
      );
    }
    if (covers.length === 0) {
      throw new Error(
        "ZIP must include at least one cover file under covers/ for catalog imports"
      );
    }
  }

  if (options.mode === "inventory_only") {
    if (csvFilesByName.has("books.csv") || csvFilesByName.has("editions.csv")) {
      throw new Error(
        "Inventory-only ZIP must not include books.csv or editions.csv"
      );
    }
    if (covers.length > 0) {
      throw new Error("Inventory-only ZIP must not include covers/");
    }
    if (!csvFilesByName.has("copies.csv") && !csvFilesByName.has("wants.csv")) {
      throw new Error(
        "Inventory-only ZIP must include at least one of copies.csv or wants.csv"
      );
    }
  }

  const parsedFiles = {
    "books.csv": emptyParsedCsv("books.csv"),
    "editions.csv": emptyParsedCsv("editions.csv"),
    "copies.csv": emptyParsedCsv("copies.csv"),
    "wants.csv": emptyParsedCsv("wants.csv"),
  } as Record<CsvFileName, ParsedCsvFile>;

  for (const [fileName, entry] of csvFilesByName.entries()) {
    const content = await entry.async("string");
    parsedFiles[fileName] = {
      fileName,
      present: true,
      headers: parseCsvHeaders(content),
      rows: parseCsvRows(content),
    };
  }

  return {
    zipName: basename(zipPath),
    sha256: sha256Hex(zipBuffer),
    mode: options.mode,
    files: parsedFiles,
    covers,
  };
}
