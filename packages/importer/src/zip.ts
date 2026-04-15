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

function toArrayBuffer(content: ArrayBuffer | Uint8Array | Buffer): ArrayBuffer {
  const bytes =
    content instanceof ArrayBuffer
      ? Uint8Array.from(new Uint8Array(content))
      : Uint8Array.from(content);

  return bytes.buffer;
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

export async function parseZipBuffer(
  content: ArrayBuffer | Uint8Array | Buffer,
  zipName: string,
  options: { mode: ImportMode }
): Promise<ParsedZipInput> {
  const zipBuffer = toArrayBuffer(content);
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
    const hasBooks = csvFilesByName.has("books.csv");
    const hasEditions = csvFilesByName.has("editions.csv");
    const hasCopies = csvFilesByName.has("copies.csv");
    const hasWishes = csvFilesByName.has("wishes.csv");
    const hasCatalogRows = hasBooks || hasEditions;

    if (hasBooks !== hasEditions) {
      throw new Error(
        "Catalog ZIP must include both books.csv and editions.csv together"
      );
    }

    if (!hasCatalogRows && !hasCopies && !hasWishes) {
      throw new Error(
        "Catalog ZIP must include books.csv + editions.csv, copies.csv, wishes.csv, or a valid combination of them"
      );
    }

    if (hasCatalogRows && covers.length === 0) {
      throw new Error(
        "Catalog ZIP must include at least one cover file under covers/ when editions.csv is present"
      );
    }

    if (!hasCatalogRows && covers.length > 0) {
      throw new Error(
        "Catalog ZIP must not include covers/ unless books.csv and editions.csv are included"
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
    if (!csvFilesByName.has("copies.csv") && !csvFilesByName.has("wishes.csv")) {
      throw new Error(
        "Inventory-only ZIP must include at least one of copies.csv or wishes.csv"
      );
    }
  }

  const parsedFiles = {
    "books.csv": emptyParsedCsv("books.csv"),
    "editions.csv": emptyParsedCsv("editions.csv"),
    "copies.csv": emptyParsedCsv("copies.csv"),
    "wishes.csv": emptyParsedCsv("wishes.csv"),
  } as Record<CsvFileName, ParsedCsvFile>;

  for (const [fileName, entry] of csvFilesByName.entries()) {
    const content = await entry.async("string");
    try {
      parsedFiles[fileName] = {
        fileName,
        present: true,
        headers: parseCsvHeaders(content),
        rows: parseCsvRows(content),
      };
    } catch (error) {
      console.error(error)
      console.log("fileName: ", fileName)
      console.log("content: ", content)
      throw error
    }
  }

  return {
    zipName: basename(zipName),
    sha256: sha256Hex(zipBuffer),
    mode: options.mode,
    files: parsedFiles,
    covers,
  };
}

export async function parseZipFile(
  zipPath: string,
  options: { mode: ImportMode }
): Promise<ParsedZipInput> {
  try {
    const raw = await readFile(zipPath);
    return parseZipBuffer(raw, basename(zipPath), options);
  } catch {
    throw new Error(`ZIP file does not exist or is not readable: ${zipPath}`);
  }
}
