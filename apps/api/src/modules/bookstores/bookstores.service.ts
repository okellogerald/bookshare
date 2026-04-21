import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
} from "drizzle-orm";
import {
  bookstoreProposals,
  type Database,
  memberProfiles,
  notifications,
  organizationInvites,
  organizationMemberships,
  organizations,
  wishes,
} from "@bookshare/db";
import {
  BookstoreMembershipRole,
  BookstoreProposalStatus,
  BookstoreStatus,
  NotificationType,
  OrganizationType,
  type BookstoreProposalNotificationMetadata,
  type NotificationBookSnapshot,
  type NotificationWishSnapshot,
} from "@bookshare/shared";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import type { AuthenticatedUser } from "../../common/guards";
import { MailerService } from "../mailer/mailer.service";
import {
  CreateAdminBookstoreDto,
  CreateBookstoreDto,
  CreateBookstoreProposalDto,
  CreateOrganizationInviteDto,
  ListAdminBookstoresQueryDto,
  ListBookstoreWantsQueryDto,
  UpdateAdminBookstoreOwnerDto,
  UpdateAdminBookstoreStatusDto,
  UpdateBookstoreDto,
  UpdateOrganizationMemberRoleDto,
} from "./dto";
import { randomBytes } from "node:crypto";

type OrganizationRecord = typeof organizations.$inferSelect;
type MembershipRecord = typeof organizationMemberships.$inferSelect;

interface KratosIdentity {
  id: string;
  schema_id?: string;
  state?: string;
  traits?: {
    email?: string;
    name?: { first?: string; last?: string };
    [key: string]: unknown;
  };
  verifiable_addresses?: Array<{
    value?: string;
    verified?: boolean;
    via?: string;
    status?: string;
  }>;
}

interface MembershipAccess {
  organization: OrganizationRecord;
  membership: MembershipRecord;
}

type BookstoreWantRow = Awaited<
  ReturnType<BookstoresService["loadMappedActiveWants"]>
>[number];

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

@Injectable()
export class BookstoresService {
  private readonly logger = new Logger(BookstoresService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly configService: ConfigService,
    private readonly mailer: MailerService
  ) {}

  async getMyBookstores(user: AuthenticatedUser) {
    const normalizedEmail = this.normalizeEmail(user.email);

    const memberships = await this.db.query.organizationMemberships.findMany({
      where: eq(organizationMemberships.userId, user.id),
      with: {
        organization: true,
      },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
    });

    const orgsToActivate = memberships
      .filter(
        (entry) =>
          entry.role === BookstoreMembershipRole.OWNER &&
          entry.organization.type === OrganizationType.BOOKSTORE &&
          entry.organization.ownerActivatedAt === null
      )
      .map((entry) => entry.organizationId);

    if (orgsToActivate.length > 0) {
      const now = new Date();
      await this.db
        .update(organizations)
        .set({ ownerActivatedAt: now })
        .where(inArray(organizations.id, orgsToActivate));
      for (const entry of memberships) {
        if (orgsToActivate.includes(entry.organizationId)) {
          entry.organization.ownerActivatedAt = now;
        }
      }
    }

    const acceptedMemberships = memberships
      .filter(
        (entry) => entry.organization.type === OrganizationType.BOOKSTORE
      )
      .map((entry) => ({
        organizationId: entry.organizationId,
        role: entry.role,
        joinedAt: entry.createdAt.toISOString(),
        organization: this.mapOrganizationSummary(entry.organization),
      }));

    const pendingInvites =
      normalizedEmail === null
        ? []
        : await this.db.query.organizationInvites.findMany({
            where: and(
              eq(organizationInvites.invitedEmail, normalizedEmail),
              eq(organizationInvites.status, "pending")
            ),
            with: {
              organization: true,
            },
            orderBy: (table, { desc }) => [desc(table.createdAt)],
          });

    return {
      memberships: acceptedMemberships,
      pendingInvites: pendingInvites
        .filter((invite) => invite.organization.type === OrganizationType.BOOKSTORE)
        .map((invite) => ({
          id: invite.id,
          invitedEmail: invite.invitedEmail,
          createdAt: invite.createdAt.toISOString(),
          organization: this.mapOrganizationSummary(invite.organization),
        })),
      user: {
        id: user.id,
        email: normalizedEmail,
        emailVerified: user.emailVerified === true,
      },
    };
  }

  async create(user: AuthenticatedUser, dto: CreateBookstoreDto) {
    this.ensureVerifiedEmail(user);
    const values = this.normalizeCreateBookstoreDto(dto);

    const organization = await this.db.transaction(async (tx) => {
      const [createdOrganization] = await tx
        .insert(organizations)
        .values({
          type: OrganizationType.BOOKSTORE,
          status: BookstoreStatus.PENDING,
          name: values.name,
          websiteUrl: values.websiteUrl,
          phone: values.phone,
          email: values.email,
          whatsapp: values.whatsapp,
          instagram: values.instagram,
          address: values.address,
          contactNote: values.contactNote,
          createdBy: user.id,
        })
        .returning();

      await tx.insert(organizationMemberships).values({
        organizationId: createdOrganization.id,
        userId: user.id,
        role: BookstoreMembershipRole.OWNER,
      });

      return createdOrganization;
    });

    return this.getOne(organization.id, user);
  }

  async getOne(bookstoreId: string, user: AuthenticatedUser) {
    const { organization, membership } = await this.requireMembershipAccess(
      bookstoreId,
      user.id
    );
    const memberCount = await this.countMembers(bookstoreId);
    const proposalCount = await this.countRecentProposals(bookstoreId);

    return {
      ...this.mapOrganizationDetail(organization),
      myRole: membership.role,
      canManageMembers: membership.role === BookstoreMembershipRole.OWNER,
      memberCount,
      recentProposalCount: proposalCount,
    };
  }

  async update(
    bookstoreId: string,
    user: AuthenticatedUser,
    dto: UpdateBookstoreDto
  ) {
    const { organization } = await this.requireOwnerAccess(bookstoreId, user.id);
    const values = this.normalizeUpdateBookstoreDto(dto);
    const [updated] = await this.db
      .update(organizations)
      .set(values)
      .where(eq(organizations.id, organization.id))
      .returning();

    return this.getOne(updated.id, user);
  }

  async resubmit(bookstoreId: string, user: AuthenticatedUser) {
    const { organization } = await this.requireOwnerAccess(bookstoreId, user.id);
    if (organization.status !== BookstoreStatus.REJECTED) {
      throw new BadRequestException("Only rejected bookstores can be resubmitted.");
    }

    const [updated] = await this.db
      .update(organizations)
      .set({
        status: BookstoreStatus.PENDING,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
      })
      .where(eq(organizations.id, organization.id))
      .returning();

    return this.getOne(updated.id, user);
  }

  async listWants(
    bookstoreId: string,
    user: AuthenticatedUser,
    query: ListBookstoreWantsQueryDto
  ) {
    await this.requireApprovedMemberAccess(bookstoreId, user.id);
    return this.loadMappedActiveWants(bookstoreId, query);
  }

  async getWant(bookstoreId: string, wishId: string, user: AuthenticatedUser) {
    await this.requireApprovedMemberAccess(bookstoreId, user.id);
    const wants = await this.loadMappedActiveWants(bookstoreId, {
      proposalState: "all",
      sort: "latest_activity_desc",
    });
    const want = wants.find((entry) => entry.id === wishId);
    if (!want) {
      throw new NotFoundException("That want is no longer active.");
    }
    return want;
  }

  async createProposal(
    bookstoreId: string,
    user: AuthenticatedUser,
    dto: CreateBookstoreProposalDto
  ) {
    const { organization } = await this.requireApprovedMemberAccess(
      bookstoreId,
      user.id
    );
    const activeExisting = await this.db.query.bookstoreProposals.findFirst({
      where: and(
        eq(bookstoreProposals.organizationId, organization.id),
        eq(bookstoreProposals.wishId, dto.wishId),
        eq(bookstoreProposals.status, BookstoreProposalStatus.ACTIVE)
      ),
    });

    if (activeExisting) {
      throw new ConflictException(
        "This bookstore already has an active proposal for that want."
      );
    }

    const wish = await this.db.query.wishes.findFirst({
      where: and(eq(wishes.id, dto.wishId), eq(wishes.status, "active")),
      with: {
        book: {
          with: {
            bookAuthors: {
              with: {
                author: true,
              },
            },
          },
        },
      },
    });

    if (!wish?.book) {
      throw new NotFoundException("That want is no longer active.");
    }

    const [proposal] = await this.db
      .insert(bookstoreProposals)
      .values({
        organizationId: organization.id,
        wishId: wish.id,
        createdBy: user.id,
        message: this.trimOptional(dto.message),
        status: BookstoreProposalStatus.ACTIVE,
      })
      .returning();

    const metadata: BookstoreProposalNotificationMetadata = {
      proposalId: proposal.id,
      organizationId: organization.id,
      organizationName: organization.name,
      wishId: wish.id,
      book: this.buildNotificationBookSnapshot(wish.book),
      wish: this.buildNotificationWishSnapshot(wish.id, wish.notes),
      proposalMessage: proposal.message,
    };

    const bookHeading = wish.book.subtitle
      ? `${wish.book.title}: ${wish.book.subtitle}`
      : wish.book.title;

    await this.db.insert(notifications).values({
      userId: wish.userId,
      type: NotificationType.BOOKSTORE_PROPOSAL,
      title: `${organization.name} sent you a bookstore proposal`,
      body: `Open the notification to view ${organization.name}'s contact details for ${bookHeading}.`,
      metadata,
      linkTo: "/notifications",
    });

    return this.mapProposal(proposal);
  }

  async withdrawProposal(
    bookstoreId: string,
    proposalId: string,
    user: AuthenticatedUser
  ) {
    await this.requireApprovedMemberAccess(bookstoreId, user.id);
    const proposal = await this.db.query.bookstoreProposals.findFirst({
      where: and(
        eq(bookstoreProposals.id, proposalId),
        eq(bookstoreProposals.organizationId, bookstoreId)
      ),
    });

    if (!proposal) {
      throw new NotFoundException("Proposal not found.");
    }

    if (proposal.status !== BookstoreProposalStatus.ACTIVE) {
      throw new BadRequestException("Only active proposals can be withdrawn.");
    }

    const [updated] = await this.db
      .update(bookstoreProposals)
      .set({
        status: BookstoreProposalStatus.WITHDRAWN,
        withdrawnAt: new Date(),
      })
      .where(eq(bookstoreProposals.id, proposalId))
      .returning();

    return this.mapProposal(updated);
  }

  async listMembers(bookstoreId: string, user: AuthenticatedUser) {
    await this.requireOwnerAccess(bookstoreId, user.id);

    const [memberships, invites] = await Promise.all([
      this.db.query.organizationMemberships.findMany({
        where: eq(organizationMemberships.organizationId, bookstoreId),
        with: {
          userProfile: true,
        },
      }),
      this.db.query.organizationInvites.findMany({
        where: and(
          eq(organizationInvites.organizationId, bookstoreId),
          eq(organizationInvites.status, "pending")
        ),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      }),
    ]);

    return {
      members: memberships
        .map((entry) => ({
          userId: entry.userId,
          role: entry.role,
          joinedAt: entry.createdAt.toISOString(),
          email: entry.userProfile?.email ?? null,
          firstName: entry.userProfile?.firstName ?? null,
          lastName: entry.userProfile?.lastName ?? null,
          location: entry.userProfile?.location ?? null,
          avatarUrl: entry.userProfile?.avatarUrl ?? null,
          displayName: this.getDisplayName(
            entry.userProfile?.firstName ?? null,
            entry.userProfile?.lastName ?? null,
            entry.userProfile?.email ?? entry.userId
          ),
        }))
        .sort((left, right) => {
          if (left.role !== right.role) {
            return left.role === BookstoreMembershipRole.OWNER ? -1 : 1;
          }
          return left.displayName.localeCompare(right.displayName, undefined, {
            sensitivity: "base",
          });
        }),
      pendingInvites: invites.map((invite) => ({
        id: invite.id,
        invitedEmail: invite.invitedEmail,
        createdAt: invite.createdAt.toISOString(),
      })),
    };
  }

  async createInvite(
    bookstoreId: string,
    user: AuthenticatedUser,
    dto: CreateOrganizationInviteDto
  ) {
    await this.requireApprovedOwnerAccess(bookstoreId, user.id);
    const normalizedEmail = this.normalizeRequiredEmail(dto.email);
    const existingMember = await this.db.query.memberProfiles.findFirst({
      columns: { userId: true },
      where: eq(memberProfiles.email, normalizedEmail),
    });

    if (existingMember) {
      const existingMembership = await this.db.query.organizationMemberships.findFirst({
        where: and(
          eq(organizationMemberships.organizationId, bookstoreId),
          eq(organizationMemberships.userId, existingMember.userId)
        ),
      });

      if (existingMembership) {
        throw new ConflictException(
          "That account is already a member of this bookstore."
        );
      }
    }

    const [invite] = await this.db
      .insert(organizationInvites)
      .values({
        organizationId: bookstoreId,
        invitedEmail: normalizedEmail,
        invitedBy: user.id,
        status: "pending",
      })
      .returning();

    return {
      id: invite.id,
      invitedEmail: invite.invitedEmail,
      createdAt: invite.createdAt.toISOString(),
    };
  }

  async acceptInvite(inviteId: string, user: AuthenticatedUser) {
    this.ensureVerifiedEmail(user);
    const normalizedEmail = this.normalizeRequiredEmail(user.email);
    const invite = await this.db.query.organizationInvites.findFirst({
      where: eq(organizationInvites.id, inviteId),
      with: {
        organization: true,
      },
    });

    if (!invite) {
      throw new NotFoundException("Invite not found.");
    }

    if (invite.status !== "pending") {
      throw new BadRequestException("That invite is no longer pending.");
    }

    if (invite.invitedEmail !== normalizedEmail) {
      throw new ForbiddenException("This invite does not belong to your email.");
    }

    if (invite.organization.status !== BookstoreStatus.APPROVED) {
      throw new BadRequestException(
        "That bookstore is not currently accepting memberships."
      );
    }

    await this.db.transaction(async (tx) => {
      await tx
        .insert(organizationMemberships)
        .values({
          organizationId: invite.organizationId,
          userId: user.id,
          role: BookstoreMembershipRole.MEMBER,
        })
        .onConflictDoNothing({
          target: [
            organizationMemberships.organizationId,
            organizationMemberships.userId,
          ],
        });

      await tx
        .update(organizationInvites)
        .set({
          status: "accepted",
          acceptedBy: user.id,
          acceptedAt: new Date(),
        })
        .where(eq(organizationInvites.id, invite.id));
    });

    return this.getMyBookstores(user);
  }

  async revokeInvite(bookstoreId: string, inviteId: string, user: AuthenticatedUser) {
    await this.requireOwnerAccess(bookstoreId, user.id);
    const invite = await this.db.query.organizationInvites.findFirst({
      where: and(
        eq(organizationInvites.id, inviteId),
        eq(organizationInvites.organizationId, bookstoreId)
      ),
    });

    if (!invite) {
      throw new NotFoundException("Invite not found.");
    }

    if (invite.status !== "pending") {
      throw new BadRequestException("Only pending invites can be revoked.");
    }

    const [updated] = await this.db
      .update(organizationInvites)
      .set({
        status: "revoked",
        revokedAt: new Date(),
      })
      .where(eq(organizationInvites.id, invite.id))
      .returning();

    return {
      id: updated.id,
      status: updated.status,
      revokedAt: toIsoString(updated.revokedAt),
    };
  }

  async updateMemberRole(
    bookstoreId: string,
    targetUserId: string,
    user: AuthenticatedUser,
    dto: UpdateOrganizationMemberRoleDto
  ) {
    await this.requireOwnerAccess(bookstoreId, user.id);
    const membership = await this.db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.organizationId, bookstoreId),
        eq(organizationMemberships.userId, targetUserId)
      ),
    });

    if (!membership) {
      throw new NotFoundException("Member not found.");
    }

    if (membership.role === dto.role) {
      return {
        userId: membership.userId,
        role: membership.role,
      };
    }

    if (
      membership.role === BookstoreMembershipRole.OWNER &&
      dto.role !== BookstoreMembershipRole.OWNER
    ) {
      await this.ensureOrganizationHasAnotherOwner(bookstoreId, membership.userId);
    }

    const [updated] = await this.db
      .update(organizationMemberships)
      .set({ role: dto.role })
      .where(eq(organizationMemberships.id, membership.id))
      .returning();

    return {
      userId: updated.userId,
      role: updated.role,
    };
  }

  async removeMember(
    bookstoreId: string,
    targetUserId: string,
    user: AuthenticatedUser
  ) {
    await this.requireOwnerAccess(bookstoreId, user.id);
    const membership = await this.db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.organizationId, bookstoreId),
        eq(organizationMemberships.userId, targetUserId)
      ),
    });

    if (!membership) {
      throw new NotFoundException("Member not found.");
    }

    if (membership.role === BookstoreMembershipRole.OWNER) {
      await this.ensureOrganizationHasAnotherOwner(bookstoreId, membership.userId);
    }

    await this.db
      .delete(organizationMemberships)
      .where(eq(organizationMemberships.id, membership.id));

    return { ok: true, userId: targetUserId };
  }

  async getPublicProfile(bookstoreId: string) {
    const organization = await this.db.query.organizations.findFirst({
      where: and(
        eq(organizations.id, bookstoreId),
        eq(organizations.type, OrganizationType.BOOKSTORE)
      ),
    });

    if (!organization) {
      throw new NotFoundException("Bookstore not found.");
    }

    return {
      id: organization.id,
      name: organization.name,
      status: organization.status,
      websiteUrl: organization.websiteUrl,
      phone: organization.phone,
      email: organization.email,
      whatsapp: organization.whatsapp,
      instagram: organization.instagram,
      address: organization.address,
      contactNote: organization.contactNote,
    };
  }

  async adminList(query: ListAdminBookstoresQueryDto) {
    const organizationsList = await this.db.query.organizations.findMany({
      where: this.buildAdminOrganizationWhere(query),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    const bookstoreIds = organizationsList.map((entry) => entry.id);
    const [memberships, proposals] =
      bookstoreIds.length === 0
        ? [[], []]
        : await Promise.all([
            this.db.query.organizationMemberships.findMany({
              where: inArray(organizationMemberships.organizationId, bookstoreIds),
              with: {
                userProfile: true,
              },
            }),
            this.db.query.bookstoreProposals.findMany({
              where: inArray(bookstoreProposals.organizationId, bookstoreIds),
            }),
          ]);

    const membershipMap = new Map<string, typeof memberships>();
    for (const membership of memberships) {
      const bucket = membershipMap.get(membership.organizationId) ?? [];
      bucket.push(membership);
      membershipMap.set(membership.organizationId, bucket);
    }

    const recentProposalCount = this.buildRecentProposalCountMap(proposals);

    return organizationsList.map((organization) => {
      const organizationMembershipList = membershipMap.get(organization.id) ?? [];
      const owners = organizationMembershipList
        .filter((entry) => entry.role === BookstoreMembershipRole.OWNER)
        .map((entry) =>
          this.getDisplayName(
            entry.userProfile?.firstName ?? null,
            entry.userProfile?.lastName ?? null,
            entry.userProfile?.email ?? entry.userId
          )
        );

      return {
        ...this.mapOrganizationSummary(organization),
        memberCount: organizationMembershipList.length,
        ownerCount: owners.length,
        ownerNames: owners,
        recentProposalCount: recentProposalCount.get(organization.id) ?? 0,
      };
    });
  }

  async adminGet(bookstoreId: string) {
    const organization = await this.db.query.organizations.findFirst({
      where: and(
        eq(organizations.id, bookstoreId),
        eq(organizations.type, OrganizationType.BOOKSTORE)
      ),
    });

    if (!organization) {
      throw new NotFoundException("Bookstore not found.");
    }

    const [memberships, inviteCount, proposals] = await Promise.all([
      this.db.query.organizationMemberships.findMany({
        where: eq(organizationMemberships.organizationId, organization.id),
        with: {
          userProfile: true,
        },
      }),
      this.db
        .select({ total: count() })
        .from(organizationInvites)
        .where(
          and(
            eq(organizationInvites.organizationId, organization.id),
            eq(organizationInvites.status, "pending")
          )
        ),
      this.db.query.bookstoreProposals.findMany({
        where: eq(bookstoreProposals.organizationId, organization.id),
      }),
    ]);

    const [inviteCountRow] = inviteCount;

    return {
      ...this.mapOrganizationDetail(organization),
      members: memberships.map((entry) => ({
        userId: entry.userId,
        role: entry.role,
        email: entry.userProfile?.email ?? null,
        firstName: entry.userProfile?.firstName ?? null,
        lastName: entry.userProfile?.lastName ?? null,
        displayName: this.getDisplayName(
          entry.userProfile?.firstName ?? null,
          entry.userProfile?.lastName ?? null,
          entry.userProfile?.email ?? entry.userId
        ),
        joinedAt: entry.createdAt.toISOString(),
      })),
      memberCount: memberships.length,
      ownerCount: memberships.filter(
        (entry) => entry.role === BookstoreMembershipRole.OWNER
      ).length,
      pendingInviteCount: Number(inviteCountRow?.total ?? 0),
      recentProposalCount: this.buildRecentProposalCountMap(proposals).get(
        organization.id
      ) ?? 0,
    };
  }

  async adminCreateWithOwner(
    user: AuthenticatedUser,
    dto: CreateAdminBookstoreDto
  ) {
    const values = this.normalizeCreateBookstoreDto({
      name: dto.name,
      websiteUrl: dto.websiteUrl,
      phone: dto.phone,
      email: dto.email,
      whatsapp: dto.whatsapp,
      instagram: dto.instagram,
      address: dto.address,
      contactNote: dto.contactNote,
    });

    const ownerEmail = this.normalizeRequiredEmail(dto.ownerEmail);
    const ownerFirst = this.trimOptional(dto.ownerFirstName);
    const ownerLast = this.trimOptional(dto.ownerLastName);
    if (!ownerFirst || !ownerLast) {
      throw new BadRequestException("Owner first and last name are required.");
    }

    const existingOwnerId = await this.findKratosIdentityIdByEmail(ownerEmail);
    if (existingOwnerId) {
      throw new ConflictException(
        "An account already exists for that email. Ask the owner to sign in and invite them via the members panel instead."
      );
    }

    const tempPassword = this.generateTempPassword();
    const ownerUserId = await this.createKratosIdentityForOwner(
      ownerEmail,
      ownerFirst,
      ownerLast,
      tempPassword
    );

    const organization = await this.db.transaction(async (tx) => {
      const [createdOrganization] = await tx
        .insert(organizations)
        .values({
          type: OrganizationType.BOOKSTORE,
          status: BookstoreStatus.PENDING,
          name: values.name,
          websiteUrl: values.websiteUrl,
          phone: values.phone,
          email: values.email,
          whatsapp: values.whatsapp,
          instagram: values.instagram,
          address: values.address,
          contactNote: values.contactNote,
          createdBy: user.id,
          reviewedBy: user.id,
          reviewedAt: new Date(),
        })
        .returning();

      await tx
        .insert(organizationMemberships)
        .values({
          organizationId: createdOrganization.id,
          userId: ownerUserId,
          role: BookstoreMembershipRole.OWNER,
        })
        .onConflictDoNothing({
          target: [
            organizationMemberships.organizationId,
            organizationMemberships.userId,
          ],
        });

      return createdOrganization;
    });

    const emailSent = await this.sendOwnerCredentialsEmail({
      email: ownerEmail,
      firstName: ownerFirst,
      bookstoreName: organization.name,
      tempPassword,
    });

    const bookstore = await this.adminGet(organization.id);

    return {
      bookstore,
      owner: {
        userId: ownerUserId,
        email: ownerEmail,
        createdIdentity: true,
      },
      emailSent,
    };
  }

  async adminUpdateBookstore(
    bookstoreId: string,
    user: AuthenticatedUser,
    dto: UpdateBookstoreDto
  ) {
    const organization = await this.requirePendingOrganization(bookstoreId);
    const values = this.normalizeUpdateBookstoreDto(dto);
    if (Object.keys(values).length === 0) {
      return this.adminGet(organization.id);
    }

    await this.db
      .update(organizations)
      .set({ ...values, reviewedBy: user.id, reviewedAt: new Date() })
      .where(eq(organizations.id, organization.id));

    return this.adminGet(organization.id);
  }

  async adminUpdateOwner(
    bookstoreId: string,
    _user: AuthenticatedUser,
    dto: UpdateAdminBookstoreOwnerDto
  ) {
    const organization = await this.requirePendingOrganization(bookstoreId);
    const ownerMembership = await this.findOwnerMembership(organization.id);
    if (!ownerMembership) {
      throw new NotFoundException("This bookstore has no owner on record.");
    }

    const nextEmail =
      dto.ownerEmail !== undefined
        ? this.normalizeRequiredEmail(dto.ownerEmail)
        : undefined;
    const nextFirst =
      dto.ownerFirstName !== undefined
        ? this.trimOptional(dto.ownerFirstName)
        : undefined;
    const nextLast =
      dto.ownerLastName !== undefined
        ? this.trimOptional(dto.ownerLastName)
        : undefined;

    if (nextFirst === null) {
      throw new BadRequestException("Owner first name cannot be empty.");
    }
    if (nextLast === null) {
      throw new BadRequestException("Owner last name cannot be empty.");
    }

    if (nextEmail) {
      const existingId = await this.findKratosIdentityIdByEmail(nextEmail);
      if (existingId && existingId !== ownerMembership.userId) {
        throw new ConflictException(
          "Another identity already uses that email in Ory."
        );
      }
    }

    await this.patchKratosIdentityTraits(ownerMembership.userId, {
      email: nextEmail,
      firstName: nextFirst,
      lastName: nextLast,
    });

    return this.adminGet(organization.id);
  }

  async adminResendOwnerEmail(bookstoreId: string) {
    const organization = await this.requirePendingOrganization(bookstoreId);
    const ownerMembership = await this.findOwnerMembership(organization.id);
    if (!ownerMembership) {
      throw new NotFoundException("This bookstore has no owner on record.");
    }

    const identity = await this.getKratosIdentity(ownerMembership.userId);
    const email = this.extractIdentityEmail(identity);
    const firstName = this.extractIdentityFirstName(identity) ?? "there";
    if (!email) {
      throw new InternalServerErrorException(
        "Owner identity is missing an email address."
      );
    }

    const tempPassword = this.generateTempPassword();
    await this.setKratosIdentityPassword(ownerMembership.userId, tempPassword);

    const emailSent = await this.sendOwnerCredentialsEmail({
      email,
      firstName,
      bookstoreName: organization.name,
      tempPassword,
    });

    return {
      emailSent,
    };
  }

  async adminUpdateStatus(
    bookstoreId: string,
    user: AuthenticatedUser,
    dto: UpdateAdminBookstoreStatusDto
  ) {
    const organization = await this.db.query.organizations.findFirst({
      where: and(
        eq(organizations.id, bookstoreId),
        eq(organizations.type, OrganizationType.BOOKSTORE)
      ),
    });

    if (!organization) {
      throw new NotFoundException("Bookstore not found.");
    }

    this.assertAllowedAdminTransition(organization.status, dto.status);

    await this.db
      .update(organizations)
      .set({
        status: dto.status,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewNote: this.trimOptional(dto.reviewNote),
      })
      .where(eq(organizations.id, organization.id));

    return this.adminGet(organization.id);
  }

  private async requireMembershipAccess(bookstoreId: string, userId: string) {
    const membership = await this.db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.organizationId, bookstoreId),
        eq(organizationMemberships.userId, userId)
      ),
      with: {
        organization: true,
      },
    });

    if (!membership || membership.organization.type !== OrganizationType.BOOKSTORE) {
      throw new ForbiddenException("You do not have access to that bookstore.");
    }

    return {
      organization: membership.organization,
      membership,
    };
  }

  private async requireOwnerAccess(bookstoreId: string, userId: string) {
    const access = await this.requireMembershipAccess(bookstoreId, userId);
    if (access.membership.role !== BookstoreMembershipRole.OWNER) {
      throw new ForbiddenException("Only bookstore owners can manage that resource.");
    }
    return access;
  }

  private async requireApprovedMemberAccess(bookstoreId: string, userId: string) {
    const access = await this.requireMembershipAccess(bookstoreId, userId);
    this.assertOrganizationCanOperate(access.organization);
    return access;
  }

  private async requireApprovedOwnerAccess(bookstoreId: string, userId: string) {
    const access = await this.requireOwnerAccess(bookstoreId, userId);
    this.assertOrganizationCanOperate(access.organization);
    return access;
  }

  private assertOrganizationCanOperate(organization: OrganizationRecord) {
    if (organization.status !== BookstoreStatus.APPROVED) {
      throw new ForbiddenException(
        "Only approved bookstores can perform that action."
      );
    }
  }

  private ensureVerifiedEmail(user: AuthenticatedUser) {
    if (user.emailVerified !== true || !this.normalizeEmail(user.email)) {
      throw new ForbiddenException(
        "A verified email address is required for this action."
      );
    }
  }

  private normalizeEmail(value: string | undefined | null) {
    const trimmed = value?.trim().toLowerCase();
    return trimmed ? trimmed : null;
  }

  private normalizeOptionalEmail(value: string | undefined) {
    if (value === undefined) return undefined;
    return this.normalizeEmail(value);
  }

  private normalizeRequiredEmail(value: string | undefined | null) {
    const normalized = this.normalizeEmail(value);
    if (!normalized) {
      throw new BadRequestException("A valid email address is required.");
    }
    return normalized;
  }

  private trimOptional(value: string | undefined | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private trimOptionalPreserveUndefined(value: string | undefined) {
    if (value === undefined) return undefined;
    return this.trimOptional(value);
  }

  private normalizeCreateBookstoreDto(dto: CreateBookstoreDto) {
    const name = this.trimOptional(dto.name);
    if (!name) {
      throw new BadRequestException("Bookstore name is required.");
    }

    return {
      name,
      websiteUrl: this.trimOptional(dto.websiteUrl),
      phone: this.trimOptional(dto.phone),
      email: this.normalizeEmail(dto.email),
      whatsapp: this.trimOptional(dto.whatsapp),
      instagram: this.trimOptional(dto.instagram),
      address: this.trimOptional(dto.address),
      contactNote: this.trimOptional(dto.contactNote),
    };
  }

  private normalizeUpdateBookstoreDto(dto: UpdateBookstoreDto) {
    return Object.fromEntries(
      Object.entries({
        name: this.trimOptionalPreserveUndefined(dto.name),
        websiteUrl: this.trimOptionalPreserveUndefined(dto.websiteUrl),
        phone: this.trimOptionalPreserveUndefined(dto.phone),
        email: this.normalizeOptionalEmail(dto.email),
        whatsapp: this.trimOptionalPreserveUndefined(dto.whatsapp),
        instagram: this.trimOptionalPreserveUndefined(dto.instagram),
        address: this.trimOptionalPreserveUndefined(dto.address),
        contactNote: this.trimOptionalPreserveUndefined(dto.contactNote),
      }).filter(([, value]) => value !== undefined)
    );
  }

  private mapOrganizationSummary(organization: OrganizationRecord) {
    return {
      id: organization.id,
      name: organization.name,
      status: organization.status,
      websiteUrl: organization.websiteUrl,
      email: organization.email,
      phone: organization.phone,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
    };
  }

  private mapOrganizationDetail(organization: OrganizationRecord) {
    return {
      id: organization.id,
      name: organization.name,
      status: organization.status,
      websiteUrl: organization.websiteUrl,
      phone: organization.phone,
      email: organization.email,
      whatsapp: organization.whatsapp,
      instagram: organization.instagram,
      address: organization.address,
      contactNote: organization.contactNote,
      createdBy: organization.createdBy,
      reviewedBy: organization.reviewedBy,
      reviewedAt: toIsoString(organization.reviewedAt),
      reviewNote: organization.reviewNote,
      ownerActivatedAt: toIsoString(organization.ownerActivatedAt),
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
    };
  }

  private mapProposal(proposal: typeof bookstoreProposals.$inferSelect) {
    return {
      id: proposal.id,
      organizationId: proposal.organizationId,
      wishId: proposal.wishId,
      message: proposal.message,
      status: proposal.status,
      createdAt: proposal.createdAt.toISOString(),
      updatedAt: proposal.updatedAt.toISOString(),
      withdrawnAt: toIsoString(proposal.withdrawnAt),
    };
  }

  private buildNotificationBookSnapshot(book: {
    id: string;
    title: string;
    subtitle: string | null;
    bookAuthors?: Array<{ author: { name: string } }> | null;
  }): NotificationBookSnapshot {
    return {
      bookId: book.id,
      title: book.title,
      subtitle: book.subtitle,
      authors: Array.from(
        new Set(
          (book.bookAuthors ?? [])
            .map((entry) => entry.author.name.trim())
            .filter((value) => value.length > 0)
        )
      ),
    };
  }

  private buildNotificationWishSnapshot(
    wishId: string,
    notes: string | null
  ): NotificationWishSnapshot {
    return {
      wishId,
      notes,
    };
  }

  private async countMembers(bookstoreId: string) {
    const [row] = await this.db
      .select({ total: count() })
      .from(organizationMemberships)
      .where(eq(organizationMemberships.organizationId, bookstoreId));

    return Number(row?.total ?? 0);
  }

  private async countRecentProposals(bookstoreId: string) {
    const recentThreshold = new Date();
    recentThreshold.setDate(recentThreshold.getDate() - 30);
    const proposals = await this.db.query.bookstoreProposals.findMany({
      where: eq(bookstoreProposals.organizationId, bookstoreId),
    });

    return proposals.filter((proposal) => proposal.createdAt >= recentThreshold)
      .length;
  }

  private async ensureOrganizationHasAnotherOwner(
    bookstoreId: string,
    excludedUserId: string
  ) {
    const owners = await this.db.query.organizationMemberships.findMany({
      where: and(
        eq(organizationMemberships.organizationId, bookstoreId),
        eq(organizationMemberships.role, BookstoreMembershipRole.OWNER)
      ),
    });

    const otherOwners = owners.filter((owner) => owner.userId !== excludedUserId);
    if (otherOwners.length === 0) {
      throw new ForbiddenException(
        "A bookstore must keep at least one owner."
      );
    }
  }

  private async loadMappedActiveWants(
    bookstoreId: string,
    query: Pick<
      ListBookstoreWantsQueryDto,
      "search" | "proposalState" | "sort"
    >
  ) {
    const [wishRows, proposals] = await Promise.all([
      this.db.query.wishes.findMany({
        where: eq(wishes.status, "active"),
        with: {
          book: {
            with: {
              bookAuthors: {
                with: {
                  author: true,
                },
              },
              editions: true,
            },
          },
          userProfile: true,
        },
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      }),
      this.db.query.bookstoreProposals.findMany({
        where: and(
          eq(bookstoreProposals.organizationId, bookstoreId),
          eq(bookstoreProposals.status, BookstoreProposalStatus.ACTIVE)
        ),
      }),
    ]);

    const proposalMap = new Map(
      proposals.map((proposal) => [proposal.wishId, proposal] as const)
    );

    const mapped = wishRows
      .filter((wish) => !!wish.book)
      .map((wish) => {
        const activeProposal = proposalMap.get(wish.id) ?? null;
        const authors = Array.from(
          new Set(
            (wish.book?.bookAuthors ?? [])
              .map((entry) => entry.author.name.trim())
              .filter((value) => value.length > 0)
          )
        );
        const editions = (wish.book?.editions ?? []).sort((left, right) => {
          const leftKey = left.isbn ?? "";
          const rightKey = right.isbn ?? "";
          return leftKey.localeCompare(rightKey, undefined, {
            sensitivity: "base",
          });
        });
        const coverEdition =
          editions.find((entry) => entry.coverImageUrl) ?? editions[0] ?? null;
        const latestActivityAt = wish.lastConfirmedAt ?? wish.createdAt;
        const wanterName = this.getDisplayName(
          wish.userProfile?.firstName ?? null,
          wish.userProfile?.lastName ?? null,
          "Member"
        );

        return {
          id: wish.id,
          userId: wish.userId,
          notes: wish.notes,
          createdAt: wish.createdAt.toISOString(),
          lastConfirmedAt: toIsoString(wish.lastConfirmedAt),
          latestActivityAt: latestActivityAt.toISOString(),
          book: {
            id: wish.book!.id,
            title: wish.book!.title,
            subtitle: wish.book!.subtitle,
            authors,
            primaryIsbn:
              editions.find((entry) => !!entry.isbn)?.isbn ?? null,
            coverImageUrl: coverEdition?.coverImageUrl ?? null,
            editions: editions.map((entry) => ({
              id: entry.id,
              isbn: entry.isbn,
              format: entry.format,
              description: entry.description,
              coverImageUrl: entry.coverImageUrl,
            })),
          },
          wanter: {
            userId: wish.userId,
            firstName: wish.userProfile?.firstName ?? null,
            lastName: wish.userProfile?.lastName ?? null,
            displayName: wanterName,
            location: wish.userProfile?.location ?? null,
            avatarUrl: wish.userProfile?.avatarUrl ?? null,
          },
          activeProposal: activeProposal
            ? {
                id: activeProposal.id,
                status: activeProposal.status,
                message: activeProposal.message,
                createdAt: activeProposal.createdAt.toISOString(),
              }
            : null,
        };
      });

    const filtered = mapped.filter((entry) => {
      if (query.proposalState === "not_proposed" && entry.activeProposal) {
        return false;
      }
      if (query.proposalState === "proposed" && !entry.activeProposal) {
        return false;
      }

      const normalizedSearch = query.search?.trim().toLowerCase();
      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        entry.book.title,
        entry.book.subtitle ?? "",
        entry.book.authors.join(" "),
        entry.book.editions
          .map((edition) => edition.isbn ?? "")
          .join(" "),
        entry.wanter.displayName,
        entry.wanter.location ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    filtered.sort((left, right) => {
      switch (query.sort) {
        case "oldest_created_asc":
          return left.createdAt.localeCompare(right.createdAt);
        case "title_asc":
          return left.book.title.localeCompare(right.book.title, undefined, {
            sensitivity: "base",
          });
        case "latest_activity_desc":
        default:
          return right.latestActivityAt.localeCompare(left.latestActivityAt);
      }
    });

    return filtered;
  }

  private buildAdminOrganizationWhere(query: ListAdminBookstoresQueryDto) {
    const filters = [eq(organizations.type, OrganizationType.BOOKSTORE)];
    if (query.status && query.status !== "all") {
      filters.push(eq(organizations.status, query.status));
    }

    const normalizedQuery = query.query?.trim();
    if (normalizedQuery) {
      const term = `%${normalizedQuery}%`;
      filters.push(
        or(
          ilike(organizations.name, term),
          ilike(organizations.email, term),
          ilike(organizations.phone, term),
          ilike(organizations.instagram, term),
          ilike(organizations.whatsapp, term),
          ilike(organizations.websiteUrl, term),
          ilike(organizations.contactNote, term)
        )!
      );

      return and(...filters);
    }

    return and(...filters);
  }

  private buildRecentProposalCountMap(
    proposals: Array<typeof bookstoreProposals.$inferSelect>
  ) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 30);
    const counts = new Map<string, number>();

    for (const proposal of proposals) {
      if (proposal.createdAt < threshold) continue;
      counts.set(
        proposal.organizationId,
        (counts.get(proposal.organizationId) ?? 0) + 1
      );
    }

    return counts;
  }

  private getDisplayName(
    firstName: string | null,
    lastName: string | null,
    fallback: string
  ) {
    const fullName = [firstName, lastName]
      .filter((value): value is string => !!value && value.trim().length > 0)
      .join(" ")
      .trim();

    return fullName || fallback;
  }

  private getKratosAdminUrl() {
    return (
      this.configService.get<string>("KRATOS_ADMIN_URL") ||
      "http://kratos:4434"
    );
  }

  private async findKratosIdentityIdByEmail(
    email: string
  ): Promise<string | null> {
    const url = new URL("/admin/identities", this.getKratosAdminUrl());
    url.searchParams.set("credentials_identifier", email);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) return null;

      const payload = (await response.json()) as Array<{ id?: string }>;
      if (!Array.isArray(payload) || payload.length === 0) return null;
      const first = payload[0];
      return typeof first?.id === "string" && first.id.length > 0
        ? first.id
        : null;
    } catch {
      return null;
    }
  }

  private async createKratosIdentityForOwner(
    email: string,
    firstName: string,
    lastName: string,
    password: string
  ): Promise<string> {
    const url = new URL("/admin/identities", this.getKratosAdminUrl());
    const body = {
      schema_id: "default",
      state: "active",
      traits: {
        email,
        name: { first: firstName, last: lastName },
      },
      credentials: {
        password: {
          config: {
            password,
          },
        },
      },
      verifiable_addresses: [
        {
          value: email,
          verified: true,
          via: "email",
          status: "completed",
        },
      ],
    };

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let message = `Kratos rejected owner identity creation (status ${response.status}).`;
      try {
        const payload = (await response.json()) as { error?: { reason?: string; message?: string } };
        if (payload?.error?.reason || payload?.error?.message) {
          message = `${payload.error.message ?? ""} ${payload.error.reason ?? ""}`.trim();
        }
      } catch {
        // keep the default message
      }
      if (response.status === 409) {
        throw new ConflictException(
          "An identity with that email already exists in Kratos."
        );
      }
      throw new InternalServerErrorException(message);
    }

    const payload = (await response.json()) as { id?: string };
    if (typeof payload.id !== "string" || payload.id.length === 0) {
      throw new InternalServerErrorException(
        "Kratos did not return an identity id."
      );
    }
    return payload.id;
  }

  private async getKratosIdentity(identityId: string): Promise<KratosIdentity> {
    const url = new URL(
      `/admin/identities/${identityId}`,
      this.getKratosAdminUrl()
    );
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Failed to load Kratos identity (status ${response.status}).`
      );
    }

    return (await response.json()) as KratosIdentity;
  }

  private async patchKratosIdentityTraits(
    identityId: string,
    update: { email?: string; firstName?: string; lastName?: string }
  ) {
    const hasAnyUpdate =
      update.email !== undefined ||
      update.firstName !== undefined ||
      update.lastName !== undefined;
    if (!hasAnyUpdate) return;

    const identity = await this.getKratosIdentity(identityId);
    const currentTraits = identity.traits ?? {};
    const currentName = (currentTraits.name ?? {}) as {
      first?: string;
      last?: string;
    };
    const nextEmail = update.email ?? currentTraits.email;
    const nextTraits = {
      ...currentTraits,
      email: nextEmail,
      name: {
        first:
          update.firstName !== undefined ? update.firstName : currentName.first,
        last:
          update.lastName !== undefined ? update.lastName : currentName.last,
      },
    };

    const nextAddresses =
      update.email !== undefined
        ? [
            {
              value: nextEmail,
              verified: true,
              via: "email",
              status: "completed",
            },
          ]
        : identity.verifiable_addresses;

    const url = new URL(
      `/admin/identities/${identityId}`,
      this.getKratosAdminUrl()
    );
    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schema_id: identity.schema_id ?? "default",
        state: identity.state ?? "active",
        traits: nextTraits,
        verifiable_addresses: nextAddresses,
      }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new ConflictException(
          "Another identity already uses that email in Ory."
        );
      }
      let message = `Kratos rejected identity update (status ${response.status}).`;
      try {
        const payload = (await response.json()) as {
          error?: { reason?: string; message?: string };
        };
        if (payload?.error?.reason || payload?.error?.message) {
          message = `${payload.error.message ?? ""} ${payload.error.reason ?? ""}`.trim();
        }
      } catch {
        // keep default
      }
      throw new InternalServerErrorException(message);
    }
  }

  private async setKratosIdentityPassword(
    identityId: string,
    password: string
  ) {
    const identity = await this.getKratosIdentity(identityId);
    const url = new URL(
      `/admin/identities/${identityId}`,
      this.getKratosAdminUrl()
    );
    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schema_id: identity.schema_id ?? "default",
        state: identity.state ?? "active",
        traits: identity.traits ?? {},
        verifiable_addresses: identity.verifiable_addresses,
        credentials: {
          password: {
            config: { password },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Failed to rotate owner password (status ${response.status}).`
      );
    }
  }

  private extractIdentityEmail(identity: KratosIdentity): string | null {
    const fromTraits =
      typeof identity.traits?.email === "string"
        ? identity.traits.email.trim()
        : "";
    if (fromTraits) return fromTraits.toLowerCase();
    const fromAddresses = identity.verifiable_addresses?.find(
      (entry) => typeof entry.value === "string" && entry.value.length > 0
    );
    return fromAddresses?.value?.toLowerCase() ?? null;
  }

  private extractIdentityFirstName(identity: KratosIdentity): string | null {
    const name = identity.traits?.name as
      | { first?: string; last?: string }
      | undefined;
    const first = name?.first?.trim();
    return first ? first : null;
  }

  private async findOwnerMembership(organizationId: string) {
    return this.db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.role, BookstoreMembershipRole.OWNER)
      ),
    });
  }

  private async requirePendingOrganization(bookstoreId: string) {
    const organization = await this.db.query.organizations.findFirst({
      where: and(
        eq(organizations.id, bookstoreId),
        eq(organizations.type, OrganizationType.BOOKSTORE)
      ),
    });

    if (!organization) {
      throw new NotFoundException("Bookstore not found.");
    }

    if (organization.ownerActivatedAt) {
      throw new BadRequestException(
        "The owner has already activated this bookstore. Ask them to update details themselves."
      );
    }

    return organization;
  }

  private generateTempPassword(length = 16): string {
    const alphabet =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i++) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  }

  private getOwnerSignInUrl(): string {
    const base =
      this.configService.get<string>("AUTH_PORTAL_PUBLIC_URL") ||
      this.configService.get<string>("BOOKSTORES_PUBLIC_URL") ||
      "http://localhost:3337";
    return base.replace(/\/+$/, "");
  }

  private async sendOwnerCredentialsEmail(input: {
    email: string;
    firstName: string;
    bookstoreName: string;
    tempPassword: string;
  }): Promise<boolean> {
    const signInUrl = this.getOwnerSignInUrl();
    const text = [
      `Hi ${input.firstName},`,
      "",
      `You have been set up as the admin for "${input.bookstoreName}" on BookShare.`,
      "",
      "Use these credentials to sign in:",
      `  Email: ${input.email}`,
      `  Temporary password: ${input.tempPassword}`,
      "",
      `Sign in at: ${signInUrl}`,
      "",
      "For security, please change this password after your first sign-in.",
      "",
      "— The BookShare team",
    ].join("\n");

    try {
      await this.mailer.sendUserConfirmation(
        input.email,
        `Your BookShare bookstore admin account (${input.bookstoreName})`,
        text
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send owner credentials email to ${input.email} for bookstore "${input.bookstoreName}"`,
        error instanceof Error ? error.stack : String(error)
      );
      return false;
    }
  }

  private assertAllowedAdminTransition(
    currentStatus: OrganizationRecord["status"],
    nextStatus: UpdateAdminBookstoreStatusDto["status"]
  ) {
    if (
      currentStatus === BookstoreStatus.PENDING &&
      (nextStatus === BookstoreStatus.APPROVED ||
        nextStatus === BookstoreStatus.REJECTED)
    ) {
      return;
    }

    if (
      currentStatus === BookstoreStatus.APPROVED &&
      nextStatus === BookstoreStatus.SUSPENDED
    ) {
      return;
    }

    if (
      currentStatus === BookstoreStatus.SUSPENDED &&
      nextStatus === BookstoreStatus.APPROVED
    ) {
      return;
    }

    throw new BadRequestException(
      `Unsupported bookstore status transition from ${currentStatus} to ${nextStatus}.`
    );
  }
}
