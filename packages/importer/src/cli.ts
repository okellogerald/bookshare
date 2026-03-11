#!/usr/bin/env bun

import { parseFlagArgs, requireFlag } from "./args";
import { runCommitCommand } from "./commands/commit";
import { runReportCommand } from "./commands/report";
import { runValidateCommand } from "./commands/validate";
import { resolveValidateZipSelection } from "./zip-input";

function usage() {
  return [
    "Usage:",
    "  bun run src/cli.ts validate --actor <admin-email> [--zip <path-to-zip>] [--inventory-only] [--replace-inventory]",
    "  bun run src/cli.ts commit --run-id <uuid>",
    "  bun run src/cli.ts report --run-id <uuid> --format json|csv",
  ].join("\n");
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlagArgs(rest);

  if (!command) {
    throw new Error(`Missing command\n\n${usage()}`);
  }

  if (command === "validate") {
    const zipSelection = await resolveValidateZipSelection(flags.zip);
    if (zipSelection.selectedFromInputFolder && zipSelection.inputFolderPath) {
      console.error(
        `[import:validate] auto-selected ZIP '${zipSelection.zipPath}' from '${zipSelection.inputFolderPath}'`
      );
    }
    const actorUsername = requireFlag(flags, "actor");
    const inventoryOnly = flags["inventory-only"] === "true";
    const replaceInventory = flags["replace-inventory"] === "true";
    await runValidateCommand({
      zipPath: zipSelection.zipPath,
      actorUsername,
      inventoryOnly,
      replaceInventory,
    });
    return;
  }

  if (command === "commit") {
    const runId = requireFlag(flags, "run-id");
    await runCommitCommand({ runId });
    return;
  }

  if (command === "report") {
    const runId = requireFlag(flags, "run-id");
    const formatRaw = flags.format ?? "json";
    if (formatRaw !== "json" && formatRaw !== "csv") {
      throw new Error(`Invalid --format value '${formatRaw}'. Expected json or csv.`);
    }
    await runReportCommand({ runId, format: formatRaw });
    return;
  }

  throw new Error(`Unknown command '${command}'\n\n${usage()}`);
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unexpected error in importer CLI";
  console.error(message);
  process.exitCode = 1;
});
