import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { type Database, collections, collectionCopies } from "@booktrack/db";
import { eq, and } from "drizzle-orm";
import { userAnd } from "../../common/tenant/tenant-scope";
import { CreateCollectionDto, UpdateCollectionDto, ManageCollectionCopiesDto } from "./dto";

@Injectable()
export class CollectionsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(dto: CreateCollectionDto, userId: string) {
    const [collection] = await this.db
      .insert(collections)
      .values({ ...dto, userId })
      .returning();
    return collection;
  }

  async update(id: string, dto: UpdateCollectionDto, userId: string) {
    const [collection] = await this.db
      .update(collections)
      .set(dto)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning();
    if (!collection) throw new NotFoundException(`Collection with ID ${id} not found`);
    return collection;
  }

  async remove(id: string, userId: string) {
    const [deleted] = await this.db
      .delete(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning({ id: collections.id });
    if (!deleted) throw new NotFoundException(`Collection with ID ${id} not found`);
    return { deleted: true };
  }

  async addCopies(id: string, dto: ManageCollectionCopiesDto, userId: string) {
    const collection = await this.db.query.collections.findFirst({
      where: userAnd(collections.userId, userId, [eq(collections.id, id)]),
    });
    if (!collection) throw new NotFoundException(`Collection with ID ${id} not found`);

    await this.db.insert(collectionCopies).values(
      dto.copyIds.map((copyId) => ({ collectionId: id, copyId }))
    ).onConflictDoNothing();

    return { added: dto.copyIds.length };
  }

  async removeCopies(id: string, dto: ManageCollectionCopiesDto, userId: string) {
    const collection = await this.db.query.collections.findFirst({
      where: userAnd(collections.userId, userId, [eq(collections.id, id)]),
    });
    if (!collection) throw new NotFoundException(`Collection with ID ${id} not found`);

    for (const copyId of dto.copyIds) {
      await this.db
        .delete(collectionCopies)
        .where(and(eq(collectionCopies.collectionId, id), eq(collectionCopies.copyId, copyId)));
    }

    return { removed: dto.copyIds.length };
  }
}
