import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { type Database, categories } from "@bookshare/db";
import { eq } from "drizzle-orm";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto";

@Injectable()
export class CategoriesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(dto: CreateCategoryDto) {
    const [category] = await this.db.insert(categories).values(dto).returning();
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const [category] = await this.db.update(categories).set(dto).where(eq(categories.id, id)).returning();
    if (!category) throw new NotFoundException(`Category with ID ${id} not found`);
    return category;
  }

  async remove(id: string) {
    const [deleted] = await this.db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
    if (!deleted) throw new NotFoundException(`Category with ID ${id} not found`);
    return { deleted: true };
  }
}
