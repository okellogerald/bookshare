import { Controller, Post, Put, Delete, Body, Param } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import {
  AuthorizationPermission,
  PlatformRole,
} from "@bookshare/shared";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto";
import { Permissions, Roles } from "../../common/decorators";

@ApiTags("Categories")
@ApiBearerAuth()
@Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
@Permissions(AuthorizationPermission.CATALOG_WRITE)
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Put(":themaCode")
  update(@Param("themaCode") themaCode: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(themaCode, dto);
  }

  @Delete(":themaCode")
  remove(@Param("themaCode") themaCode: string) {
    return this.categoriesService.remove(themaCode);
  }
}
