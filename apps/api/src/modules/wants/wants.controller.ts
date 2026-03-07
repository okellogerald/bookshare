import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { WantsService } from "./wants.service";
import { CreateWantDto, UpdateWantDto } from "./dto";
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

  @Get("search")
  search(
    @Query("q") query: string
  ): Promise<
    Array<{
      bookId: string;
      title: string;
      subtitle: string | null;
      authors: Array<{ id: string; name: string }>;
      primaryIsbn: string | null;
      hasEdition: boolean;
      hasCommunityCopy: boolean;
    }>
  > {
    return this.wantsService.search(query ?? "");
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

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateWantDto,
    @CurrentUser("id") userId: string
  ) {
    return this.wantsService.update(id, dto, userId);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.wantsService.remove(id, userId);
  }
}
