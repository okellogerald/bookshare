import { commitImportRun } from "../runs";

function reportProgress(stage: string, detail?: string) {
  if (detail) {
    console.error(`[import:commit] ${stage} | ${detail}`);
    return;
  }
  console.error(`[import:commit] ${stage}`);
}

export async function runCommitCommand(params: { runId: string }) {
  await commitImportRun({
    runId: params.runId,
    onProgress: reportProgress,
  });
}
