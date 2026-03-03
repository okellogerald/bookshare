import { Controller, Post, Put, Delete, Body, Param } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { BooksService } from "./books.service";
import { CreateBookDto, UpdateBookDto } from "./dto";

@ApiTags("Books")
@ApiBearerAuth()
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
