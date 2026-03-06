import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { UploadService } from "./upload.service";
import {
  CreateCopyImagePresignDto,
  CreateEditionCoverPresignDto,
} from "./dto";
import { CurrentUser } from "../../common/decorators";

@ApiTags("Upload")
@ApiBearerAuth()
@Controller("upload")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get("config")
  getConfig() {
    return this.uploadService.getUploadConfig();
  }

  @Post("copy-image-presign")
  createCopyImagePresign(
    @Body() dto: CreateCopyImagePresignDto,
    @CurrentUser("id") userId: string
  ) {
    return this.uploadService.createCopyImagePresign(dto, userId);
  }

  @Post("edition-cover-presign")
  createEditionCoverPresign(
    @Body() dto: CreateEditionCoverPresignDto,
    @CurrentUser("id") userId: string
  ) {
    return this.uploadService.createEditionCoverPresign(dto, userId);
  }
}
