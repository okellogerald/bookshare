import { Controller, Post, Put, Delete, Body, Param } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import {
  AuthorizationPermission,
  PlatformRole,
} from "@bookshare/shared";
import { BooksService } from "./books.service";
import { CreateBookDto, UpdateBookDto } from "./dto";
import { Permissions, Roles } from "../../common/decorators";

@ApiTags("Books")
@ApiBearerAuth()
@Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
@Permissions(AuthorizationPermission.CATALOG_WRITE)
@Controller("books")
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post()
  create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBookDto) {
    return this.booksService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.booksService.remove(id);
  }
}
