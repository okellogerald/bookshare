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
import { WishClosureReason, WorkflowTopic } from "@bookshare/shared";
import { eq, and, isNull } from "drizzle-orm";
import { userScope, userAnd } from "../../common/tenant/tenant-scope";
import { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import {
  AttachCopyImagesDto,
  CreateCopyDto,
  UpdateCopyDto,
  UpdateCopyStatusDto,
} from "./dto";

type MemberProfileRecord = typeof memberProfiles.$inferSelect;
type ActiveLoanRecord = typeof copyLoans.$inferSelect & {
  counterpartyProfile?: MemberProfileRecord | null;
};

interface MemberCounterpartySnapshot extends Record<string, unknown> {
  type: "member";
  userId: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  location: string | null;
  contactNotes: string | null;
  avatarUrl: string | null;
}

interface ExternalCounterpartySnapshot extends Record<string, unknown> {
  type: "external";
  name: string;
  contact: string | null;
}

type CounterpartySnapshot =
  | MemberCounterpartySnapshot
  | ExternalCounterpartySnapshot;

function trimToUndefined(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getMemberDisplayName(profile: MemberProfileRecord) {
  const fullName = [profile.firstName, profile.lastName]
    .filter((value): value is string => !!value && value.trim().length > 0)
    .join(" ")
    .trim();
  return fullName || "Community member";
}

function buildMemberCounterpartySnapshot(
  profile: MemberProfileRecord
): MemberCounterpartySnapshot {
  return {
    type: "member",
    userId: profile.userId,
    name: getMemberDisplayName(profile),
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    location: profile.location ?? null,
    contactNotes: profile.contactNotes ?? null,
    avatarUrl: profile.avatarUrl ?? null,
  };
}

function buildExternalCounterpartySnapshot(
  name: string,
  contact?: string
): ExternalCounterpartySnapshot {
  return {
    type: "external",
    name,
    contact: contact ?? null,
  };
}

function buildLoanCounterpartySnapshot(loan: ActiveLoanRecord) {
  if (loan.counterpartyType === "member" && loan.counterpartyProfile) {
    return buildMemberCounterpartySnapshot(loan.counterpartyProfile);
  }

  if (loan.counterpartyType === "external" && loan.externalName) {
    return buildExternalCounterpartySnapshot(
      loan.externalName,
      loan.externalContact ?? undefined
    );
  }

  return null;
}

@Injectable()
export class CopiesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly workflowEvents: WorkflowEventsService
  ) {}

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

      // Auto-create LISTED event for the copy timeline.
      await tx.insert(copyEvents).values({
        userId,
        copyId: copy.id,
        eventType: "listed",
        toStatus: copy.status,
        performedBy: userId,
        notes: "Copy added to library",
      });

      return copy.id;
    });

    const createdCopy = await this.findOne(copyId, userId);
    await this.workflowEvents.publish(WorkflowTopic.COPY_CREATED, {
      copyId: createdCopy.id,
      userId,
    });

    return createdCopy;
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
          eventType: "condition_changed",
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
    const goneReason = dto.goneReason;
    const notes = trimToUndefined(dto.notes);
    const externalCounterpartyName = trimToUndefined(
      dto.externalCounterpartyName
    );
    const externalCounterpartyContact = trimToUndefined(
      dto.externalCounterpartyContact
    );
    const counterpartyStatuses = ["lent", "gone"] as const;
    const wishFulfillmentStatuses = ["lent", "gone"] as const;

    if (fromStatus === toStatus) {
      throw new BadRequestException("status must change");
    }

    const allowsCounterparty = (counterpartyStatuses as readonly string[]).includes(
      toStatus
    );
    const hasCounterpartyFields =
      dto.counterpartyType !== undefined ||
      dto.counterpartyUserId !== undefined ||
      externalCounterpartyName !== undefined ||
      externalCounterpartyContact !== undefined;
    const hasCounterpartyDetailsWithoutType =
      dto.counterpartyType === undefined &&
      (dto.counterpartyUserId !== undefined ||
        externalCounterpartyName !== undefined ||
        externalCounterpartyContact !== undefined);

    if (!allowsCounterparty && hasCounterpartyFields) {
      throw new BadRequestException(
        "counterparty fields are only allowed for lent and gone"
      );
    }

    if (hasCounterpartyDetailsWithoutType) {
      throw new BadRequestException(
        "counterpartyType is required when counterparty details are provided"
      );
    }

    if ((toStatus === "available" || toStatus === "shelved") && !notes) {
      throw new BadRequestException(
        "notes are required when marking a copy available or shelved"
      );
    }

    if (toStatus === "lent" && !dto.counterpartyType) {
      throw new BadRequestException(
        "counterpartyType is required when status is lent"
      );
    }

    if (toStatus === "gone" && !goneReason) {
      throw new BadRequestException(
        "goneReason is required when status is gone"
      );
    }

    if (toStatus !== "gone" && goneReason !== undefined) {
      throw new BadRequestException(
        "goneReason is only allowed when status is gone"
      );
    }

    if (toStatus === "gone" && !dto.counterpartyType && !notes) {
      throw new BadRequestException(
        "status changes to gone require notes or counterparty details"
      );
    }

    if (dto.counterpartyType === "member") {
      if (!dto.counterpartyUserId) {
        throw new BadRequestException(
          "counterpartyUserId is required when counterpartyType is member"
        );
      }
      if (dto.counterpartyUserId === userId) {
        throw new BadRequestException(
          "counterpartyUserId cannot be the owner of the copy"
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
    const shouldResolveActiveWant =
      dto.counterpartyType === "member" &&
      (wishFulfillmentStatuses as readonly string[]).includes(toStatus);

    let counterpartyProfile: MemberProfileRecord | null = null;

    if (counterpartyUserId) {
      const counterparty = await this.db.query.memberProfiles.findFirst({
        where: eq(memberProfiles.userId, counterpartyUserId),
      });
      if (!counterparty) {
        throw new NotFoundException("Counterparty member profile not found");
      }
      counterpartyProfile = counterparty;
    }

    const matchingWantCondition = eq(wants.bookId, existing.edition.book.id);
    const selectedCounterpartySnapshot =
      dto.counterpartyType === "member" && counterpartyProfile
        ? buildMemberCounterpartySnapshot(counterpartyProfile)
        : dto.counterpartyType === "external" && externalCounterpartyName
          ? buildExternalCounterpartySnapshot(
              externalCounterpartyName,
              externalCounterpartyContact
            )
          : null;

    const activeWant =
      shouldResolveActiveWant && counterpartyUserId
        ? await this.db.query.wants.findFirst({
        where: and(
          eq(wants.userId, counterpartyUserId),
          matchingWantCondition,
          eq(wants.status, "active")
        ),
          })
        : null;

    // Determine event type from the target status
    const eventTypeMap: Record<string, string> = {
      lent: "lent",
      available:
        fromStatus === "lent"
          ? "returned"
          : "status_changed",
      shelved: "status_changed",
    };

    const eventType =
      toStatus === "gone"
        ? goneReason!
        : eventTypeMap[toStatus] ?? "status_changed";
    const isLoanStatus = toStatus === "lent";
    const now = new Date();

    const updatedCopy = await this.db.transaction(async (tx) => {
      const activeLoan = await tx.query.copyLoans.findFirst({
        where: and(eq(copyLoans.copyId, id), isNull(copyLoans.returnedAt)),
        with: {
          counterpartyProfile: true,
        },
      });

      let openedLoanId: string | undefined;
      let closedLoanId: string | undefined;
      let closedLoanCounterparty: CounterpartySnapshot | null = null;

      if (isLoanStatus && dto.counterpartyType) {
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
            notes,
            startedAt: now,
            createdBy: userId,
          })
          .returning({ id: copyLoans.id });

        openedLoanId = createdLoan?.id;
      } else if (activeLoan) {
        closedLoanCounterparty = buildLoanCounterpartySnapshot(activeLoan);
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

      const metadata: Record<string, unknown> = {};

      if (selectedCounterpartySnapshot) {
        metadata.counterpartyType = selectedCounterpartySnapshot.type;
        metadata.counterpartyUserId =
          selectedCounterpartySnapshot.type === "member"
            ? selectedCounterpartySnapshot.userId
            : null;
        metadata.externalCounterpartyName =
          selectedCounterpartySnapshot.type === "external"
            ? selectedCounterpartySnapshot.name
            : null;
        metadata.externalCounterpartyContact =
          selectedCounterpartySnapshot.type === "external"
            ? selectedCounterpartySnapshot.contact
            : null;
        metadata.counterparty = selectedCounterpartySnapshot;
      }

      if (openedLoanId) {
        metadata.openedLoanId = openedLoanId;
      }

      if (closedLoanId) {
        metadata.closedLoanId = closedLoanId;
      }

      if (closedLoanCounterparty) {
        metadata.closedLoanCounterparty = closedLoanCounterparty;
      }

      if (goneReason) {
        metadata.goneReason = goneReason;
      }

      if (activeWant) {
        metadata.autoClosedWish = {
          wishId: activeWant.id,
          userId: activeWant.userId,
          closureReason:
            toStatus === "lent"
              ? WishClosureReason.MATCHED_MEMBER_LENT
              : WishClosureReason.MATCHED_MEMBER_GONE,
        };
      }

      await tx.insert(copyEvents).values({
        userId,
        copyId: id,
        eventType: eventType as any,
        fromStatus: fromStatus as any,
        toStatus: toStatus as any,
        performedBy: userId,
        notes,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });

      if (activeWant) {
        await tx
          .update(wants)
          .set({
            status: "fulfilled",
            closureReason:
              toStatus === "lent"
                ? WishClosureReason.MATCHED_MEMBER_LENT
                : WishClosureReason.MATCHED_MEMBER_GONE,
            closedAt: now,
            fulfilledAt: now,
            fulfilledByCopyId: id,
            fulfilledByUserId: userId,
          })
          .where(and(eq(wants.id, activeWant.id), eq(wants.status, "active")));
      }

      return this.findOne(id, userId);
    });

    if (fromStatus !== toStatus) {
      await this.workflowEvents.publish(WorkflowTopic.COPY_STATUS_CHANGED, {
        copyId: updatedCopy.id,
        userId,
        fromStatus,
        toStatus: updatedCopy.status,
      });
    }

    return updatedCopy;
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

  // ── Admin operations (no userId scoping) ──────────────────

  private async findOneAdmin(id: string) {
    const copy = await this.db.query.copies.findFirst({
      where: eq(copies.id, id),
      with: { edition: { with: { book: true } } },
    });
    if (!copy) throw new NotFoundException(`Copy with ID ${id} not found`);
    return copy;
  }

  async adminUpdate(id: string, dto: UpdateCopyDto) {
    const existing = await this.findOneAdmin(id);

    return this.db.transaction(async (tx) => {
      await tx.update(copies).set(dto as any).where(eq(copies.id, id));

      if (dto.condition && dto.condition !== existing.condition) {
        await tx.insert(copyEvents).values({
          userId: existing.userId,
          copyId: id,
          eventType: "condition_changed",
          performedBy: "admin",
          notes: `Condition changed from ${existing.condition} to ${dto.condition}`,
          metadata: {
            fromCondition: existing.condition,
            toCondition: dto.condition,
          },
        });
      }

      return this.findOneAdmin(id);
    });
  }

  async adminDelete(id: string) {
    await this.findOneAdmin(id);
    await this.db.delete(copies).where(eq(copies.id, id));
    return { deleted: true };
  }

  async adminArchive(id: string) {
    const existing = await this.findOneAdmin(id);

    if (existing.status === "shelved") {
      throw new BadRequestException("Copy is already shelved.");
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(copies)
        .set({ status: "shelved" })
        .where(eq(copies.id, id));

      await tx.insert(copyEvents).values({
        userId: existing.userId,
        copyId: id,
        eventType: "status_changed",
        fromStatus: existing.status,
        toStatus: "shelved",
        performedBy: "admin",
        notes: "Archived by admin",
      });
    });

    return { archived: true };
  }

  async adminUnarchive(id: string) {
    const existing = await this.findOneAdmin(id);

    if (existing.status !== "shelved") {
      throw new BadRequestException(
        "Only shelved copies can be unarchived."
      );
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(copies)
        .set({ status: "available" })
        .where(eq(copies.id, id));

      await tx.insert(copyEvents).values({
        userId: existing.userId,
        copyId: id,
        eventType: "status_changed",
        fromStatus: "shelved",
        toStatus: "available",
        performedBy: "admin",
        notes: "Unarchived by admin",
      });
    });

    return { unarchived: true };
  }
}
