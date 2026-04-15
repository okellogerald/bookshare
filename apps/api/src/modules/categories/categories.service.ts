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

  async update(themaCode: string, dto: UpdateCategoryDto) {
    const [category] = await this.db.update(categories).set(dto).where(eq(categories.themaCode, themaCode)).returning();
    if (!category) throw new NotFoundException(`Category with code ${themaCode} not found`);
    return category;
  }

  async remove(themaCode: string) {
    const [deleted] = await this.db.delete(categories).where(eq(categories.themaCode, themaCode)).returning({ themaCode: categories.themaCode });
    if (!deleted) throw new NotFoundException(`Category with code ${themaCode} not found`);
    return { deleted: true };
  }
}
