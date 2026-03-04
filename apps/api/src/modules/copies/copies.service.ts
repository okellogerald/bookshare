import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { type Database, copies, copyEvents } from "@booktrack/db";
import { eq, and } from "drizzle-orm";
import { userScope, userAnd } from "../../common/tenant/tenant-scope";
import { CreateCopyDto, UpdateCopyDto, UpdateCopyStatusDto } from "./dto";

@Injectable()
export class CopiesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(userId: string) {
    return this.db.query.copies.findMany({
      where: userScope(copies.userId, userId),
      with: {
        edition: { with: { book: true } },
        collectionCopies: { with: { collection: true } },
      },
      orderBy: (copies, { desc }) => [desc(copies.createdAt)],
    });
  }

  async findOne(id: string, userId: string) {
    const copy = await this.db.query.copies.findFirst({
      where: userAnd(copies.userId, userId, [
        eq(copies.id, id),
      ]),
      with: {
        edition: { with: { book: true } },
        events: {
          orderBy: (events, { desc }) => [desc(events.createdAt)],
        },
        collectionCopies: { with: { collection: true } },
      },
    });

    if (!copy) throw new NotFoundException(`Copy with ID ${id} not found`);
    return copy;
  }

  async create(dto: CreateCopyDto, userId: string) {
    const copyId = await this.db.transaction(async (tx) => {
      const [copy] = await tx
        .insert(copies)
        .values({
          userId,
          editionId: dto.editionId,
          condition: dto.condition as any,
          status: (dto.status as any) ?? "available",
          acquisitionType: dto.acquisitionType as any,
          acquisitionDate: dto.acquisitionDate
            ? new Date(dto.acquisitionDate)
            : null,
          location: dto.location,
          notes: dto.notes,
          shareType: dto.shareType as any,
          contactNote: dto.contactNote,
          lastConfirmedAt: new Date(),
        })
        .returning();

      // Auto-create ACQUIRED event
      await tx.insert(copyEvents).values({
        userId,
        copyId: copy.id,
        eventType: "acquired",
        toStatus: copy.status,
        performedBy: userId,
        amount: dto.acquisitionAmount,
        currency: dto.acquisitionCurrency,
        notes: `Copy acquired via ${dto.acquisitionType}`,
      });

      return copy.id;
    });

    return this.findOne(copyId, userId);
  }

  async update(id: string, dto: UpdateCopyDto, userId: string) {
    const existing = await this.findOne(id, userId);

    return this.db.transaction(async (tx) => {
      await tx
        .update(copies)
        .set(dto as any)
        .where(
          and(eq(copies.id, id), eq(copies.userId, userId))
        );

      // If condition changed, log it
      if (dto.condition && dto.condition !== existing.condition) {
        await tx.insert(copyEvents).values({
          userId,
          copyId: id,
          eventType: "condition_change",
          performedBy: userId,
          notes: `Condition changed from ${existing.condition} to ${dto.condition}`,
          metadata: {
            fromCondition: existing.condition,
            toCondition: dto.condition,
          },
        });
      }

      return this.findOne(id, userId);
    });
  }

  async updateStatus(id: string, dto: UpdateCopyStatusDto, userId: string) {
    const existing = await this.findOne(id, userId);
    const fromStatus = existing.status;
    const toStatus = dto.status;

    // Determine event type from the target status
    const eventTypeMap: Record<string, string> = {
      sold: "sold",
      rented: "rented",
      available: fromStatus === "rented" ? "returned" : "status_change",
      donated: "donated",
      given_away: "given_away",
      lost: "lost",
      damaged: "damaged",
    };

    const eventType = eventTypeMap[toStatus] ?? "status_change";

    return this.db.transaction(async (tx) => {
      await tx
        .update(copies)
        .set({ status: toStatus as any })
        .where(
          and(eq(copies.id, id), eq(copies.userId, userId))
        );

      await tx.insert(copyEvents).values({
        userId,
        copyId: id,
        eventType: eventType as any,
        fromStatus: fromStatus as any,
        toStatus: toStatus as any,
        performedBy: userId,
        amount: dto.amount,
        currency: dto.currency,
        notes: dto.notes,
      });

      return this.findOne(id, userId);
    });
  }

  async confirm(id: string, userId: string) {
    await this.findOne(id, userId);
    const [updated] = await this.db
      .update(copies)
      .set({ lastConfirmedAt: new Date() })
      .where(and(eq(copies.id, id), eq(copies.userId, userId)))
      .returning();
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.db
      .delete(copies)
      .where(
        and(eq(copies.id, id), eq(copies.userId, userId))
      );
    return { deleted: true };
  }
}
