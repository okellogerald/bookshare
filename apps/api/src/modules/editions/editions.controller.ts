import { Controller, Post, Put, Delete, Body, Param } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { EditionsService } from "./editions.service";
import { CreateEditionDto, UpdateEditionDto } from "./dto";

@ApiTags("Editions")
@ApiBearerAuth()
@Controller("editions")
export class EditionsController {
  constructor(private readonly editionsService: EditionsService) {}

  @Post()
  create(@Body() dto: CreateEditionDto) {
    return this.editionsService.create(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateEditionDto) {
    return this.editionsService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.editionsService.remove(id);
  }
}
