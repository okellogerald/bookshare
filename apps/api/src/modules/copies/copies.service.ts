import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import {
  type Database,
  copies,
  copyEvents,
  copyImages,
  copyLoans,
  memberProfiles,
  wants,
} from "@bookshare/db";
import { eq, and, isNull } from "drizzle-orm";
import { userScope, userAnd } from "../../common/tenant/tenant-scope";
import {
  AttachCopyImagesDto,
  CreateCopyDto,
  UpdateCopyDto,
  UpdateCopyStatusDto,
} from "./dto";

@Injectable()
export class CopiesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(userId: string) {
    return this.db.query.copies.findMany({
      where: userScope(copies.userId, userId),
      with: {
        edition: { with: { book: true } },
        collectionCopies: { with: { collection: true } },
        images: {
          orderBy: (images, { asc }) => [
            asc(images.sortOrder),
            asc(images.createdAt),
          ],
        },
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
        images: {
          orderBy: (images, { asc }) => [
            asc(images.sortOrder),
            asc(images.createdAt),
          ],
        },
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
        notes: "Copy added to library",
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
    const externalCounterpartyName = dto.externalCounterpartyName?.trim();
    const externalCounterpartyContact = dto.externalCounterpartyContact?.trim();
    const loanStatuses = ["lent", "rented", "checked_out"] as const;
    const requiresCounterpartyStatuses = [
      "lent",
      "rented",
      "checked_out",
      "sold",
      "given_away",
    ] as const;
    const requiresActiveWantStatuses = ["lent", "sold", "given_away"] as const;
    const fulfillsWantStatuses = ["sold", "given_away"] as const;

    const requiresCounterparty = (requiresCounterpartyStatuses as readonly string[])
      .includes(toStatus);
    const hasCounterpartyFields =
      dto.counterpartyType !== undefined ||
      dto.counterpartyUserId !== undefined ||
      externalCounterpartyName !== undefined ||
      externalCounterpartyContact !== undefined;

    if (requiresCounterparty && !dto.counterpartyType) {
      throw new BadRequestException(
        "counterpartyType is required for lent, rented, checked_out, sold, and given_away"
      );
    }
    if (!requiresCounterparty && hasCounterpartyFields) {
      throw new BadRequestException(
        "counterparty fields are only allowed for lent, rented, checked_out, sold, and given_away"
      );
    }

    if (!requiresCounterparty && dto.counterpartyType) {
      throw new BadRequestException(
        "counterpartyType is only allowed for lent, rented, checked_out, sold, and given_away"
      );
    }

    if (dto.counterpartyType === "member") {
      if (!dto.counterpartyUserId) {
        throw new BadRequestException(
          "counterpartyUserId is required when counterpartyType is member"
        );
      }
      if (externalCounterpartyName || externalCounterpartyContact) {
        throw new BadRequestException(
          "external counterparty fields are not allowed when counterpartyType is member"
        );
      }
    }

    if (dto.counterpartyType === "external") {
      if (dto.counterpartyUserId) {
        throw new BadRequestException(
          "counterpartyUserId is not allowed when counterpartyType is external"
        );
      }
      if (!externalCounterpartyName) {
        throw new BadRequestException(
          "externalCounterpartyName is required when counterpartyType is external"
        );
      }
    }

    const counterpartyUserId =
      dto.counterpartyType === "member" ? dto.counterpartyUserId ?? null : null;
    const shouldValidateActiveWant =
      dto.counterpartyType === "member" &&
      (requiresActiveWantStatuses as readonly string[]).includes(toStatus);

    if (counterpartyUserId) {
      const counterparty = await this.db.query.memberProfiles.findFirst({
        where: eq(memberProfiles.userId, counterpartyUserId),
      });
      if (!counterparty) {
        throw new NotFoundException("Counterparty member profile not found");
      }
    }

    if (shouldValidateActiveWant && counterpartyUserId) {
      const activeWant = await this.db.query.wants.findFirst({
        where: and(
          eq(wants.userId, counterpartyUserId),
          eq(wants.bookId, existing.edition.book.id),
          eq(wants.status, "active")
        ),
      });

      if (!activeWant) {
        throw new BadRequestException(
          "counterpartyUserId must belong to a member with an active want for this book"
        );
      }
    }

    // Determine event type from the target status
    const eventTypeMap: Record<string, string> = {
      lent: "lent",
      sold: "sold",
      rented: "rented",
      available:
        fromStatus === "rented" ||
        fromStatus === "lent" ||
        fromStatus === "checked_out"
          ? "returned"
          : "status_change",
      donated: "donated",
      given_away: "given_away",
      lost: "lost",
      damaged: "damaged",
    };

    const eventType = eventTypeMap[toStatus] ?? "status_change";
    const isLoanStatus = (loanStatuses as readonly string[]).includes(toStatus);
    const now = new Date();

    return this.db.transaction(async (tx) => {
      const [activeLoan] = await tx
        .select({
          id: copyLoans.id,
        })
        .from(copyLoans)
        .where(
          and(eq(copyLoans.copyId, id), isNull(copyLoans.returnedAt))
        )
        .limit(1);

      let openedLoanId: string | undefined;
      let closedLoanId: string | undefined;

      if (isLoanStatus) {
        if (!dto.counterpartyType) {
          throw new BadRequestException(
            "counterpartyType is required for loan statuses"
          );
        }
        if (activeLoan) {
          throw new BadRequestException(
            "Copy already has an active loan. Mark it returned before creating a new loan."
          );
        }

        const [createdLoan] = await tx
          .insert(copyLoans)
          .values({
            userId,
            copyId: id,
            loanType: toStatus as any,
            counterpartyType: dto.counterpartyType as any,
            counterpartyUserId,
            externalName: externalCounterpartyName,
            externalContact: externalCounterpartyContact,
            notes: dto.notes,
            startedAt: now,
            createdBy: userId,
          })
          .returning({ id: copyLoans.id });

        openedLoanId = createdLoan?.id;
      } else if (activeLoan) {
        const [closedLoan] = await tx
          .update(copyLoans)
          .set({
            returnedAt: now,
          })
          .where(eq(copyLoans.id, activeLoan.id))
          .returning({ id: copyLoans.id });
        closedLoanId = closedLoan?.id;
      }

      await tx
        .update(copies)
        .set({
          status: toStatus as any,
        })
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
        notes: dto.notes,
        metadata: dto.counterpartyType
          ? {
              counterpartyType: dto.counterpartyType,
              counterpartyUserId,
              externalCounterpartyName: externalCounterpartyName ?? null,
              externalCounterpartyContact: externalCounterpartyContact ?? null,
              openedLoanId: openedLoanId ?? null,
              closedLoanId: closedLoanId ?? null,
            }
          : openedLoanId || closedLoanId
            ? {
                openedLoanId: openedLoanId ?? null,
                closedLoanId: closedLoanId ?? null,
              }
            : undefined,
      });

      if (
        counterpartyUserId &&
        (fulfillsWantStatuses as readonly string[]).includes(toStatus)
      ) {
        await tx
          .update(wants)
          .set({
            status: "fulfilled",
            fulfilledAt: now,
            fulfilledByCopyId: id,
            fulfilledByUserId: userId,
          })
          .where(
            and(
              eq(wants.userId, counterpartyUserId),
              eq(wants.bookId, existing.edition.book.id),
              eq(wants.status, "active")
            )
          );
      }

      return this.findOne(id, userId);
    });
  }

  async attachImages(
    copyId: string,
    dto: AttachCopyImagesDto,
    userId: string
  ) {
    await this.findOne(copyId, userId);
    if (dto.images.length === 0) return [];

    const existingImages = await this.db.query.copyImages.findMany({
      where: and(eq(copyImages.copyId, copyId), eq(copyImages.userId, userId)),
    });

    if (existingImages.length + dto.images.length > 5) {
      throw new BadRequestException("A copy can only have up to 5 images");
    }

    return this.db
      .insert(copyImages)
      .values(
        dto.images.map((image, index) => ({
          copyId,
          userId,
          objectKey: image.objectKey,
          imageUrl: image.imageUrl,
          sortOrder:
            image.sortOrder ??
            existingImages.length + index,
        }))
      )
      .returning();
  }

  async removeImage(copyId: string, imageId: string, userId: string) {
    await this.findOne(copyId, userId);
    const [deleted] = await this.db
      .delete(copyImages)
      .where(
        and(
          eq(copyImages.id, imageId),
          eq(copyImages.copyId, copyId),
          eq(copyImages.userId, userId)
        )
      )
      .returning({ id: copyImages.id });

    if (!deleted) {
      throw new NotFoundException("Copy image not found");
    }

    return { deleted: true };
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
