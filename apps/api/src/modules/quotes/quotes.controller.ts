import { Controller, Post, Put, Delete, Body, Param } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { QuotesService } from "./quotes.service";
import { CreateQuoteDto, UpdateQuoteDto } from "./dto";
import { CurrentUser } from "../../common/decorators";
import type { AuthenticatedUser } from "../../common/guards";

@ApiTags("Quotes")
@ApiBearerAuth()
@Controller("quotes")
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  create(@Body() dto: CreateQuoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.quotesService.create(dto, user.id);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotesService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.quotesService.remove(id);
  }
}
