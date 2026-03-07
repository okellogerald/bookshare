import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { type Database, authors } from "@bookshare/db";
import { eq } from "drizzle-orm";
import { CreateAuthorDto, UpdateAuthorDto } from "./dto";

@Injectable()
export class AuthorsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(dto: CreateAuthorDto) {
    const [author] = await this.db.insert(authors).values({ name: dto.name }).returning();
    return author;
  }

  async update(id: string, dto: UpdateAuthorDto) {
    const [author] = await this.db.update(authors).set(dto).where(eq(authors.id, id)).returning();
    if (!author) throw new NotFoundException(`Author with ID ${id} not found`);
    return author;
  }

  async remove(id: string) {
    const [deleted] = await this.db.delete(authors).where(eq(authors.id, id)).returning({ id: authors.id });
    if (!deleted) throw new NotFoundException(`Author with ID ${id} not found`);
    return { deleted: true };
  }
}
