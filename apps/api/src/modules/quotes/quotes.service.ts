import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { type Database, bookQuotes } from "@bookshare/db";
import { eq } from "drizzle-orm";
import { CreateQuoteDto, UpdateQuoteDto } from "./dto";

@Injectable()
export class QuotesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(dto: CreateQuoteDto, userId: string) {
    const [quote] = await this.db
      .insert(bookQuotes)
      .values({ ...dto, addedBy: userId })
      .returning();
    return quote;
  }

  async update(id: string, dto: UpdateQuoteDto) {
    const [quote] = await this.db.update(bookQuotes).set(dto).where(eq(bookQuotes.id, id)).returning();
    if (!quote) throw new NotFoundException(`Quote with ID ${id} not found`);
    return quote;
  }

  async remove(id: string) {
    const [deleted] = await this.db.delete(bookQuotes).where(eq(bookQuotes.id, id)).returning({ id: bookQuotes.id });
    if (!deleted) throw new NotFoundException(`Quote with ID ${id} not found`);
    return { deleted: true };
  }
}
