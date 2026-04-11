import { validateImportZipFile } from "../runs";

export async function runValidateCommand(params: {
  zipPath: string;
  actorUsername: string;
  inventoryOnly: boolean;
  replaceInventory: boolean;
}) {
  const output = await validateImportZipFile(params);

  console.log(JSON.stringify(output, null, 2));
  if (output.status !== "validated") {
    process.exitCode = 2;
  }
}
