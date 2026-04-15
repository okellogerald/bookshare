import { Controller, Post, Put, Delete, Body, Param } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { UserRole } from "@bookshare/shared";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto";
import { Roles } from "../../common/decorators";

@ApiTags("Categories")
@ApiBearerAuth()
@Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
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
