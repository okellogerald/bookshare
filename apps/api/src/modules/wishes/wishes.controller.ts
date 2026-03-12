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
import { WishesService } from "./wishes.service";
import { CreateWishDto, UpdateWishDto } from "./dto";
import { CurrentUser } from "../../common/decorators";

@ApiTags("Wishes")
@ApiBearerAuth()
@Controller("wishes")
export class WishesController {
  constructor(private readonly wishesService: WishesService) {}

  @Get()
  findAll(@CurrentUser("id") userId: string) {
    return this.wishesService.findAll(userId);
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
      editions: Array<{
        id: string;
        isbn: string | null;
        format: string;
        coverImageUrl: string | null;
      }>;
      primaryIsbn: string | null;
      hasEdition: boolean;
      hasCommunityCopy: boolean;
    }>
  > {
    return this.wishesService.search(query ?? "");
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.wishesService.findOne(id, userId);
  }

  @Post()
  create(@Body() dto: CreateWishDto, @CurrentUser("id") userId: string) {
    return this.wishesService.create(dto, userId);
  }

  @Patch(":id/confirm")
  confirm(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.wishesService.confirm(id, userId);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateWishDto,
    @CurrentUser("id") userId: string
  ) {
    return this.wishesService.update(id, dto, userId);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.wishesService.remove(id, userId);
  }
}
