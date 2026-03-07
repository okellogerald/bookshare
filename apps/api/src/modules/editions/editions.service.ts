import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { type Database, editions } from "@bookshare/db";
import { eq } from "drizzle-orm";
import { CreateEditionDto, UpdateEditionDto } from "./dto";

@Injectable()
export class EditionsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(dto: CreateEditionDto) {
    const [edition] = await this.db.insert(editions).values(dto as any).returning();
    return edition;
  }

  async update(id: string, dto: UpdateEditionDto) {
    const [edition] = await this.db.update(editions).set(dto as any).where(eq(editions.id, id)).returning();
    if (!edition) throw new NotFoundException(`Edition with ID ${id} not found`);
    return edition;
  }

  async remove(id: string) {
    const [deleted] = await this.db.delete(editions).where(eq(editions.id, id)).returning({ id: editions.id });
    if (!deleted) throw new NotFoundException(`Edition with ID ${id} not found`);
    return { deleted: true };
  }
}
