import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { type Database, wants } from "@booktrack/db";
import { eq, and } from "drizzle-orm";
import { userScope, userAnd } from "../../common/tenant/tenant-scope";
import { CreateWantDto } from "./dto";

@Injectable()
export class WantsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(userId: string) {
    return this.db.query.wants.findMany({
      where: userScope(wants.userId, userId),
      with: { book: true },
      orderBy: (wants, { desc }) => [desc(wants.createdAt)],
    });
  }

  async findOne(id: string, userId: string) {
    const want = await this.db.query.wants.findFirst({
      where: userAnd(wants.userId, userId, [eq(wants.id, id)]),
      with: { book: true },
    });

    if (!want) throw new NotFoundException(`Want with ID ${id} not found`);
    return want;
  }

  async create(dto: CreateWantDto, userId: string) {
    // Check for duplicate (user_id, book_id)
    const existing = await this.db.query.wants.findFirst({
      where: and(eq(wants.userId, userId), eq(wants.bookId, dto.bookId)),
    });

    if (existing) {
      throw new ConflictException(
        "You already have a want for this book"
      );
    }

    const [want] = await this.db
      .insert(wants)
      .values({
        userId,
        bookId: dto.bookId,
        notes: dto.notes,
        lastConfirmedAt: new Date(),
      })
      .returning();

    return this.findOne(want.id, userId);
  }

  async confirm(id: string, userId: string) {
    await this.findOne(id, userId);
    const [updated] = await this.db
      .update(wants)
      .set({ lastConfirmedAt: new Date() })
      .where(and(eq(wants.id, id), eq(wants.userId, userId)))
      .returning();
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.db
      .delete(wants)
      .where(and(eq(wants.id, id), eq(wants.userId, userId)));
    return { deleted: true };
  }
}
