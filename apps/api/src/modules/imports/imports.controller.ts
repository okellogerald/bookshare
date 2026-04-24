import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AuthorizationPermission,
  PlatformRole,
} from "@bookshare/shared";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser, Permissions, Roles } from "../../common/decorators";
import type { AuthenticatedUser } from "../../common/guards";
import { ImportsService } from "./imports.service";

interface UploadedZipFile {
  buffer: Buffer;
  originalname?: string;
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

@ApiTags("Imports")
@ApiBearerAuth()
@Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
@Controller("imports")
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get()
  @Permissions(AuthorizationPermission.IMPORT_READ)
  listRecentRuns(@Query("limit") limitRaw?: string) {
    const limit =
      typeof limitRaw === "string" && limitRaw.trim().length > 0
        ? Number.parseInt(limitRaw, 10)
        : undefined;

    return this.importsService.listRecentRuns(limit);
  }

  @Post("validate")
  @UseInterceptors(FileInterceptor("zip"))
  @Permissions(AuthorizationPermission.IMPORT_VALIDATE)
  validateZip(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedZipFile | undefined,
    @Body() body: { mode?: string; replaceInventory?: string | boolean }
  ) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException("A ZIP file is required.");
    }

    return this.importsService.validateZip({
      actor: user,
      zipBuffer: file.buffer,
      zipName: file.originalname || "import.zip",
      mode: body.mode === "inventory_only" ? "inventory_only" : "catalog",
      replaceInventory: toBoolean(body.replaceInventory),
    });
  }

  @Post(":runId/commit")
  @Permissions(AuthorizationPermission.IMPORT_COMMIT)
  commitRun(@Param("runId") runId: string) {
    return this.importsService.commitRun(runId);
  }
}
