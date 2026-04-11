import { BadRequestException, Injectable } from "@nestjs/common";
import {
  commitImportRun,
  listRecentImportRuns,
  validateImportZipBuffer,
} from "@bookshare/importer";
import type { AuthenticatedUser } from "../../common/guards";

@Injectable()
export class ImportsService {
  async listRecentRuns(limit?: number) {
    const normalizedLimit =
      typeof limit === "number" && Number.isFinite(limit)
        ? Math.min(Math.max(limit, 1), 20)
        : 10;

    return listRecentImportRuns(normalizedLimit);
  }

  async validateZip(params: {
    actor: AuthenticatedUser;
    zipBuffer: Buffer;
    zipName: string;
    mode: "catalog" | "inventory_only";
    replaceInventory: boolean;
  }) {
    if (params.replaceInventory && params.mode !== "inventory_only") {
      throw new BadRequestException(
        "replaceInventory is only allowed for inventory-only imports."
      );
    }

    const actorIdentifier =
      params.actor.email?.trim() ||
      params.actor.username?.trim() ||
      params.actor.id;

    return validateImportZipBuffer({
      zipBuffer: params.zipBuffer,
      zipName: params.zipName,
      actorUsername: actorIdentifier,
      inventoryOnly: params.mode === "inventory_only",
      replaceInventory: params.replaceInventory,
    });
  }

  async commitRun(runId: string) {
    return commitImportRun({ runId });
  }
}
