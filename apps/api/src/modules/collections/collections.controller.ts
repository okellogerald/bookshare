import { Controller, Post, Put, Delete, Body, Param } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { CollectionsService } from "./collections.service";
import { CreateCollectionDto, UpdateCollectionDto, ManageCollectionCopiesDto } from "./dto";
import { CurrentUser } from "../../common/decorators";

@ApiTags("Collections")
@ApiBearerAuth()
@Controller("collections")
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  create(@Body() dto: CreateCollectionDto, @CurrentUser("id") userId: string) {
    return this.collectionsService.create(dto, userId);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCollectionDto, @CurrentUser("id") userId: string) {
    return this.collectionsService.update(id, dto, userId);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.collectionsService.remove(id, userId);
  }

  @Post(":id/copies")
  addCopies(@Param("id") id: string, @Body() dto: ManageCollectionCopiesDto, @CurrentUser("id") userId: string) {
    return this.collectionsService.addCopies(id, dto, userId);
  }

  @Delete(":id/copies")
  removeCopies(@Param("id") id: string, @Body() dto: ManageCollectionCopiesDto, @CurrentUser("id") userId: string) {
    return this.collectionsService.removeCopies(id, dto, userId);
  }
}
