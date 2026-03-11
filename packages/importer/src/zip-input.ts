import { mkdir, readdir, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";

export interface ValidateZipSelection {
  zipPath: string;
  selectedFromInputFolder: boolean;
  inputFolderPath: string | null;
}

interface ZipCandidate {
  path: string;
  mtimeMs: number;
}

function defaultInputFolderPath(): string {
  const envPath = (process.env.IMPORTER_INPUT_DIR ?? "").trim();
  if (envPath) return resolve(envPath);
  return resolve(process.cwd(), "input");
}

async function listZipCandidates(inputFolderPath: string): Promise<ZipCandidate[]> {
  const entries = await readdir(inputFolderPath, { withFileTypes: true });
  const zipFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".zip"))
    .map((entry) => resolve(inputFolderPath, entry.name));

  const out: ZipCandidate[] = [];
  for (const path of zipFiles) {
    const fileStat = await stat(path);
    out.push({ path, mtimeMs: fileStat.mtimeMs });
  }
  return out;
}

export async function resolveValidateZipSelection(
  explicitZipPath: string | undefined
): Promise<ValidateZipSelection> {
  const trimmedExplicit = explicitZipPath?.trim();
  if (trimmedExplicit) {
    return {
      zipPath: trimmedExplicit,
      selectedFromInputFolder: false,
      inputFolderPath: null,
    };
  }

  const inputFolderPath = defaultInputFolderPath();
  await mkdir(inputFolderPath, { recursive: true });

  const candidates = await listZipCandidates(inputFolderPath);
  if (candidates.length === 0) {
    throw new Error(
      `No .zip files found in input folder '${inputFolderPath}'. Add a ZIP there or pass --zip <path>.`
    );
  }

  candidates.sort((left, right) => {
    if (right.mtimeMs !== left.mtimeMs) return right.mtimeMs - left.mtimeMs;
    return basename(left.path).localeCompare(basename(right.path));
  });

  return {
    zipPath: candidates[0]!.path,
    selectedFromInputFolder: true,
    inputFolderPath,
  };
}
