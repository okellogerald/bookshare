import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import JSZip from "jszip";
import { parseCsvHeaders, parseCsvRows } from "./csv";
import { CSV_FILES, type CsvFileName, type ParsedCsvFile, type ParsedZipInput } from "./types";

export function sha256Hex(content: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(content)).digest("hex");
}

function assertCsvFileName(value: string): value is CsvFileName {
  return (CSV_FILES as readonly string[]).includes(value);
}

export async function parseZipFile(zipPath: string): Promise<ParsedZipInput> {
  let zipBuffer: ArrayBuffer;
  try {
    const raw = await readFile(zipPath);
    zipBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  } catch {
    throw new Error(`ZIP file does not exist or is not readable: ${zipPath}`);
  }

  const zip = await JSZip.loadAsync(zipBuffer);

  const csvFilesByName = new Map<CsvFileName, JSZip.JSZipObject>();
  const seenNames = new Set<string>();

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const name = basename(entry.name).trim();
    if (!name) continue;

    if (!assertCsvFileName(name)) {
      throw new Error(
        `Unexpected file in ZIP: ${entry.name}. Expected only ${CSV_FILES.join(", ")}`
      );
    }

    if (seenNames.has(name)) {
      throw new Error(`Duplicate CSV detected in ZIP: ${name}`);
    }

    seenNames.add(name);
    csvFilesByName.set(name, entry);
  }

  const missing = CSV_FILES.filter((name) => !csvFilesByName.has(name));
  if (missing.length > 0) {
    throw new Error(`ZIP is missing required CSV files: ${missing.join(", ")}`);
  }

  if (csvFilesByName.size !== CSV_FILES.length) {
    throw new Error(`ZIP must contain exactly these files: ${CSV_FILES.join(", ")}`);
  }

  const parsedFiles = {} as Record<CsvFileName, ParsedCsvFile>;

  for (const fileName of CSV_FILES) {
    const entry = csvFilesByName.get(fileName)!;
    const content = await entry.async("string");
    parsedFiles[fileName] = {
      fileName,
      headers: parseCsvHeaders(content),
      rows: parseCsvRows(content),
    };
  }

  return {
    zipName: basename(zipPath),
    sha256: sha256Hex(zipBuffer),
    files: parsedFiles,
  };
}
