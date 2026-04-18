import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { PlatformRole } from "@bookshare/shared";
import { CopiesService } from "./copies.service";
import {
  AdminCreateCopyDto,
  AttachCopyImagesDto,
  CreateCopyDto,
  UpdateCopyDto,
  UpdateCopyStatusDto,
} from "./dto";
import { CurrentUser, Roles } from "../../common/decorators";
import type { AuthenticatedUser } from "../../common/guards";

@ApiTags("Copies")
@ApiBearerAuth()
@Controller("copies")
export class CopiesController {
  constructor(private readonly copiesService: CopiesService) {}

  @Get()
  findAll(@CurrentUser("id") userId: string) {
    return this.copiesService.findAll(userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.copiesService.findOne(id, userId);
  }

  @Post()
  create(
    @Body() dto: CreateCopyDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.copiesService.create(dto, user.id);
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCopyDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.copiesService.update(id, dto, user.id);
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateCopyStatusDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.copiesService.updateStatus(id, dto, user.id);
  }

  @Patch(":id/confirm")
  confirm(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.copiesService.confirm(id, userId);
  }

  @Post(":id/images")
  attachImages(
    @Param("id") id: string,
    @Body() dto: AttachCopyImagesDto,
    @CurrentUser("id") userId: string
  ) {
    return this.copiesService.attachImages(id, dto, userId);
  }

  @Delete(":id/images/:imageId")
  removeImage(
    @Param("id") id: string,
    @Param("imageId") imageId: string,
    @CurrentUser("id") userId: string
  ) {
    return this.copiesService.removeImage(id, imageId, userId);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.copiesService.remove(id, userId);
  }

  // ── Admin operations ───────────────────────────────────────

  @Post("admin")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  adminCreate(@Body() dto: AdminCreateCopyDto) {
    return this.copiesService.adminCreate(dto);
  }

  @Put(":id/admin")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  adminUpdate(@Param("id") id: string, @Body() dto: UpdateCopyDto) {
    return this.copiesService.adminUpdate(id, dto);
  }

  @Delete(":id/admin")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  adminDelete(@Param("id") id: string) {
    return this.copiesService.adminDelete(id);
  }

  @Patch(":id/archive")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  adminArchive(@Param("id") id: string) {
    return this.copiesService.adminArchive(id);
  }

  @Patch(":id/unarchive")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  adminUnarchive(@Param("id") id: string) {
    return this.copiesService.adminUnarchive(id);
  }
}
