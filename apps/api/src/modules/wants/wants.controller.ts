import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { WantsService } from "./wants.service";
import { CreateWantDto } from "./dto";
import { CurrentUser } from "../../common/decorators";

@ApiTags("Wants")
@ApiBearerAuth()
@Controller("wants")
export class WantsController {
  constructor(private readonly wantsService: WantsService) {}

  @Get()
  findAll(@CurrentUser("id") userId: string) {
    return this.wantsService.findAll(userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.wantsService.findOne(id, userId);
  }

  @Post()
  create(@Body() dto: CreateWantDto, @CurrentUser("id") userId: string) {
    return this.wantsService.create(dto, userId);
  }

  @Patch(":id/confirm")
  confirm(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.wantsService.confirm(id, userId);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.wantsService.remove(id, userId);
  }
}
