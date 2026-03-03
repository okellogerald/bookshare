import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { UploadService } from "./upload.service";

@ApiTags("Upload")
@ApiBearerAuth()
@Controller("upload")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get("config")
  getConfig() {
    return this.uploadService.getUploadConfig();
  }
}
