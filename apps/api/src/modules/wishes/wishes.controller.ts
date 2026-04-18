import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { PlatformRole } from "@bookshare/shared";
import { WishesService } from "./wishes.service";
import { CreateWishDto, UpdateWishDto } from "./dto";
import { CurrentUser, Roles } from "../../common/decorators";

@ApiTags("Wishes")
@ApiBearerAuth()
@Controller("wishes")
export class WishesController {
  constructor(private readonly wishesService: WishesService) {}

  @Get()
  findAll(@CurrentUser("id") userId: string) {
    return this.wishesService.findAll(userId);
  }

  @Get("search")
  search(
    @Query("q") query: string
    ): Promise<
    Array<{
      bookId: string;
      title: string;
      subtitle: string | null;
      authors: Array<{ id: string; name: string }>;
      editions: Array<{
        id: string;
        isbn: string | null;
        format: string;
        coverImageUrl: string | null;
      }>;
      primaryIsbn: string | null;
      hasEdition: boolean;
      hasCommunityCopy: boolean;
    }>
  > {
    return this.wishesService.search(query ?? "");
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.wishesService.findOne(id, userId);
  }

  @Post()
  create(@Body() dto: CreateWishDto, @CurrentUser("id") userId: string) {
    return this.wishesService.create(dto, userId);
  }

  @Patch(":id/confirm")
  confirm(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.wishesService.confirm(id, userId);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateWishDto,
    @CurrentUser("id") userId: string
  ) {
    return this.wishesService.update(id, dto, userId);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.wishesService.remove(id, userId);
  }

  // ── Admin operations ───────────────────────────────────────

  @Put(":id/admin")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  adminUpdate(@Param("id") id: string, @Body() dto: UpdateWishDto) {
    return this.wishesService.adminUpdate(id, dto);
  }

  @Delete(":id/admin")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  adminDelete(@Param("id") id: string) {
    return this.wishesService.adminDelete(id);
  }

  @Patch(":id/admin/archive")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  adminArchive(@Param("id") id: string) {
    return this.wishesService.adminArchive(id);
  }

  @Patch(":id/admin/restore")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  adminRestore(@Param("id") id: string) {
    return this.wishesService.adminRestore(id);
  }
}
