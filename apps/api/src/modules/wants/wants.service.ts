import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { type Database, copies, editions, wants } from "@booktrack/db";
import { eq, and, inArray } from "drizzle-orm";
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
    // Check for duplicate active want (user_id, book_id)
    const existing = await this.db.query.wants.findFirst({
      where: and(
        eq(wants.userId, userId),
        eq(wants.bookId, dto.bookId),
        eq(wants.status, "active")
      ),
    });

    if (existing) {
      throw new ConflictException(
        "You already have a want for this book"
      );
    }

    const activeOwnership = await this.db
      .select({ id: copies.id })
      .from(copies)
      .innerJoin(editions, eq(copies.editionId, editions.id))
      .where(
        and(
          eq(copies.userId, userId),
          eq(editions.bookId, dto.bookId),
          inArray(copies.status, [
            "available",
            "reserved",
            "lent",
            "checked_out",
          ] as any[])
        )
      )
      .limit(1);

    if (activeOwnership.length > 0) {
      throw new ConflictException(
        "You already have an active copy of this book in your library"
      );
    }

    const [want] = await this.db
      .insert(wants)
      .values({
        userId,
        bookId: dto.bookId,
        notes: dto.notes,
        status: "active",
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
    const [updated] = await this.db
      .update(wants)
      .set({ status: "cancelled" })
      .where(and(eq(wants.id, id), eq(wants.userId, userId)))
      .returning();
    return updated;
  }
}
