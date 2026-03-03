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
import { CopiesService } from "./copies.service";
import { CreateCopyDto, UpdateCopyDto, UpdateCopyStatusDto } from "./dto";
import { CurrentUser } from "../../common/decorators";
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

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.copiesService.remove(id, userId);
  }
}
