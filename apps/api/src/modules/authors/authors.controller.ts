import { Controller, Post, Put, Delete, Body, Param } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { AuthorsService } from "./authors.service";
import { CreateAuthorDto, UpdateAuthorDto } from "./dto";

@ApiTags("Authors")
@ApiBearerAuth()
@Controller("authors")
export class AuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Post()
  create(@Body() dto: CreateAuthorDto) {
    return this.authorsService.create(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAuthorDto) {
    return this.authorsService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.authorsService.remove(id);
  }
}
