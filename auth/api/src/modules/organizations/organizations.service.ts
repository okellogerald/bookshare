import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, count, eq, inArray } from "drizzle-orm";
import type { AuthDatabase } from "../../db/database";
import { AUTH_DB } from "../../db/database.module";
import {
  authOrganizationInvites,
  authOrganizationMemberships,
  authOrganizations,
  authUserProfiles,
} from "../../db/schema";
import type { AuthenticatedUser } from "../../common/auth";
import {
  CreateOrganizationDto,
  CreateOrganizationInviteDto,
  UpdateOrganizationDto,
} from "./dto";

type OrganizationRecord = typeof authOrganizations.$inferSelect;
type OrganizationRole = "admin" | "staff";

interface MembershipAccess {
  organization: OrganizationRecord;
  membership: typeof authOrganizationMemberships.$inferSelect;
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

@Injectable()
export class OrganizationsService {
  constructor(@Inject(AUTH_DB) private readonly db: AuthDatabase) {}

  async getMe(user: AuthenticatedUser) {
    await this.ensureUserProfile(user);
    const normalizedEmail = this.normalizeEmail(user.email);

    const memberships = await this.db.query.authOrganizationMemberships.findMany({
      where: eq(authOrganizationMemberships.userId, user.id),
      with: { organization: true },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
    });

    const pendingInvites =
      normalizedEmail === null
        ? []
        : await this.db.query.authOrganizationInvites.findMany({
            where: and(
              eq(authOrganizationInvites.invitedEmail, normalizedEmail),
              eq(authOrganizationInvites.status, "pending")
            ),
            with: { organization: true },
            orderBy: (table, { desc }) => [desc(table.createdAt)],
          });

    return {
      memberships: memberships.map((entry) => ({
        organizationId: entry.organizationId,
        role: entry.role,
        joinedAt: entry.createdAt.toISOString(),
        organization: this.mapOrganizationSummary(entry.organization),
      })),
      pendingInvites: pendingInvites.map((invite) => ({
        id: invite.id,
        invitedEmail: invite.invitedEmail,
        role: invite.role,
        createdAt: invite.createdAt.toISOString(),
        organization: this.mapOrganizationSummary(invite.organization),
      })),
      user: {
        id: user.id,
        email: normalizedEmail,
        emailVerified: user.emailVerified,
        roles: user.roles,
      },
    };
  }

  async adminList() {
    const organizations = await this.db.query.authOrganizations.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    const organizationIds = organizations.map((entry) => entry.id);
    if (organizationIds.length === 0) {
      return [];
    }

    const [memberships, pendingInvites] = await Promise.all([
      this.db.query.authOrganizationMemberships.findMany({
        where: inArray(authOrganizationMemberships.organizationId, organizationIds),
        with: { profile: true },
      }),
      this.db.query.authOrganizationInvites.findMany({
        where: and(
          inArray(authOrganizationInvites.organizationId, organizationIds),
          eq(authOrganizationInvites.status, "pending")
        ),
      }),
    ]);

    return organizations.map((organization) => {
      const orgMemberships = memberships.filter(
        (entry) => entry.organizationId === organization.id
      );
      const orgInvites = pendingInvites.filter(
        (entry) => entry.organizationId === organization.id
      );
      const adminNames = orgMemberships
        .filter((entry) => entry.role === "admin")
        .map((entry) =>
          this.getDisplayName(
            entry.profile?.firstName ?? null,
            entry.profile?.lastName ?? null,
            entry.profile?.email ?? entry.userId
          )
        );

      return {
        ...this.mapOrganizationSummary(organization),
        memberCount: orgMemberships.length,
        adminCount: adminNames.length,
        adminNames,
        pendingInviteCount: orgInvites.length,
      };
    });
  }

  async adminCreate(user: AuthenticatedUser, dto: CreateOrganizationDto) {
    const name = this.normalizeName(dto.name);
    const adminEmail =
      dto.adminEmail === undefined
        ? null
        : this.normalizeRequiredEmail(dto.adminEmail);

    const result = await this.db.transaction(async (tx) => {
      const [organization] = await tx
        .insert(authOrganizations)
        .values({
          name,
          status: "active",
          createdBy: user.id,
        })
        .returning();

      const invite = adminEmail
        ? await this.createInviteRecord(tx, {
            organizationId: organization.id,
            invitedBy: user.id,
            email: adminEmail,
            role: "admin",
          })
        : null;

      return { organization, invite };
    });

    return {
      organization: this.mapOrganizationSummary(result.organization),
      adminInvite: result.invite ? this.mapInvite(result.invite) : null,
    };
  }

  async adminInvite(
    organizationId: string,
    user: AuthenticatedUser,
    dto: CreateOrganizationInviteDto
  ) {
    await this.requireOrganization(organizationId);
    const invite = await this.createInviteRecord(this.db, {
      organizationId,
      invitedBy: user.id,
      email: dto.email,
      role: dto.role ?? "admin",
    });
    return this.mapInvite(invite);
  }

  async getOne(organizationId: string, user: AuthenticatedUser) {
    await this.ensureUserProfile(user);
    const { organization, membership } = await this.requireMembership(
      organizationId,
      user.id
    );
    const memberCount = await this.countMembers(organization.id);

    return {
      ...this.mapOrganizationDetail(organization),
      myRole: membership.role,
      canManageMembers: membership.role === "admin",
      memberCount,
    };
  }

  async update(
    organizationId: string,
    user: AuthenticatedUser,
    dto: UpdateOrganizationDto
  ) {
    const { organization } = await this.requireOrganizationAdmin(
      organizationId,
      user.id
    );
    const updates: Partial<typeof authOrganizations.$inferInsert> = {};
    if (dto.name !== undefined) {
      updates.name = this.normalizeName(dto.name);
    }

    if (Object.keys(updates).length === 0) {
      return this.getOne(organization.id, user);
    }

    const [updated] = await this.db
      .update(authOrganizations)
      .set(updates)
      .where(eq(authOrganizations.id, organization.id))
      .returning();

    return this.getOne(updated.id, user);
  }

  async listMembers(organizationId: string, user: AuthenticatedUser) {
    await this.requireOrganizationAdmin(organizationId, user.id);
    const [memberships, invites] = await Promise.all([
      this.db.query.authOrganizationMemberships.findMany({
        where: eq(authOrganizationMemberships.organizationId, organizationId),
        with: { profile: true },
      }),
      this.db.query.authOrganizationInvites.findMany({
        where: and(
          eq(authOrganizationInvites.organizationId, organizationId),
          eq(authOrganizationInvites.status, "pending")
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
          email: entry.profile?.email ?? null,
          firstName: entry.profile?.firstName ?? null,
          lastName: entry.profile?.lastName ?? null,
          displayName: this.getDisplayName(
            entry.profile?.firstName ?? null,
            entry.profile?.lastName ?? null,
            entry.profile?.email ?? entry.userId
          ),
        }))
        .sort((left, right) => {
          if (left.role !== right.role) return left.role === "admin" ? -1 : 1;
          return left.displayName.localeCompare(right.displayName, undefined, {
            sensitivity: "base",
          });
        }),
      pendingInvites: invites.map((invite) => ({
        id: invite.id,
        invitedEmail: invite.invitedEmail,
        role: invite.role,
        createdAt: invite.createdAt.toISOString(),
      })),
    };
  }

  async createInvite(
    organizationId: string,
    user: AuthenticatedUser,
    dto: CreateOrganizationInviteDto
  ) {
    await this.requireOrganizationAdmin(organizationId, user.id);
    const invite = await this.createInviteRecord(this.db, {
      organizationId,
      invitedBy: user.id,
      email: dto.email,
      role: dto.role ?? "staff",
    });
    return this.mapInvite(invite);
  }

  async revokeInvite(
    organizationId: string,
    inviteId: string,
    user: AuthenticatedUser
  ) {
    await this.requireOrganizationAdmin(organizationId, user.id);
    const invite = await this.db.query.authOrganizationInvites.findFirst({
      where: and(
        eq(authOrganizationInvites.id, inviteId),
        eq(authOrganizationInvites.organizationId, organizationId)
      ),
    });

    if (!invite) throw new NotFoundException("Invite not found.");
    if (invite.status !== "pending") {
      throw new BadRequestException("Only pending invites can be revoked.");
    }

    const [updated] = await this.db
      .update(authOrganizationInvites)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(authOrganizationInvites.id, invite.id))
      .returning();

    return this.mapInvite(updated);
  }

  async acceptInvite(inviteId: string, user: AuthenticatedUser) {
    this.ensureVerifiedEmail(user);
    await this.ensureUserProfile(user);
    const normalizedEmail = this.normalizeRequiredEmail(user.email);
    const invite = await this.db.query.authOrganizationInvites.findFirst({
      where: eq(authOrganizationInvites.id, inviteId),
      with: { organization: true },
    });

    if (!invite) throw new NotFoundException("Invite not found.");
    if (invite.status !== "pending") {
      throw new BadRequestException("That invite is no longer pending.");
    }
    if (invite.invitedEmail !== normalizedEmail) {
      throw new ForbiddenException("This invite does not belong to your email.");
    }
    if (invite.organization.status !== "active") {
      throw new BadRequestException("That organization is not active.");
    }

    const existing = await this.db.query.authOrganizationMemberships.findFirst({
      where: and(
        eq(authOrganizationMemberships.organizationId, invite.organizationId),
        eq(authOrganizationMemberships.userId, user.id)
      ),
    });
    if (existing) {
      throw new ConflictException("You are already a member of this organization.");
    }

    await this.db.transaction(async (tx) => {
      await tx.insert(authOrganizationMemberships).values({
        organizationId: invite.organizationId,
        userId: user.id,
        role: invite.role,
        invitedBy: invite.invitedBy,
      });

      await tx
        .update(authOrganizationInvites)
        .set({
          status: "accepted",
          acceptedBy: user.id,
          acceptedAt: new Date(),
        })
        .where(eq(authOrganizationInvites.id, invite.id));
    });

    return this.getMe(user);
  }

  private async createInviteRecord(
    db: any,
    input: {
      organizationId: string;
      invitedBy: string;
      email: string;
      role: OrganizationRole;
    }
  ) {
    const email = this.normalizeRequiredEmail(input.email);
    const organization = await db.query.authOrganizations.findFirst({
      where: eq(authOrganizations.id, input.organizationId),
    });
    if (!organization) throw new NotFoundException("Organization not found.");
    if (organization.status !== "active") {
      throw new BadRequestException("That organization is not active.");
    }

    const pendingInvite = await db.query.authOrganizationInvites.findFirst({
      where: and(
        eq(authOrganizationInvites.organizationId, input.organizationId),
        eq(authOrganizationInvites.invitedEmail, email),
        eq(authOrganizationInvites.status, "pending")
      ),
    });
    if (pendingInvite) {
      throw new ConflictException("That email already has a pending invite.");
    }

    const profile = await db.query.authUserProfiles.findFirst({
      where: eq(authUserProfiles.email, email),
    });
    if (profile) {
      const membership = await db.query.authOrganizationMemberships.findFirst({
        where: and(
          eq(authOrganizationMemberships.organizationId, input.organizationId),
          eq(authOrganizationMemberships.userId, profile.userId)
        ),
      });
      if (membership) {
        throw new ConflictException(
          "That account is already a member of this organization."
        );
      }
    }

    const [invite] = await db
      .insert(authOrganizationInvites)
      .values({
        organizationId: input.organizationId,
        invitedEmail: email,
        role: input.role,
        invitedBy: input.invitedBy,
        status: "pending",
      })
      .returning();

    return invite;
  }

  private async requireOrganization(organizationId: string) {
    const organization = await this.db.query.authOrganizations.findFirst({
      where: eq(authOrganizations.id, organizationId),
    });
    if (!organization) throw new NotFoundException("Organization not found.");
    return organization;
  }

  private async requireMembership(
    organizationId: string,
    userId: string
  ): Promise<MembershipAccess> {
    const membership =
      await this.db.query.authOrganizationMemberships.findFirst({
        where: and(
          eq(authOrganizationMemberships.organizationId, organizationId),
          eq(authOrganizationMemberships.userId, userId)
        ),
        with: { organization: true },
      });

    if (!membership) {
      throw new ForbiddenException("You do not have access to that organization.");
    }

    return { organization: membership.organization, membership };
  }

  private async requireOrganizationAdmin(organizationId: string, userId: string) {
    const access = await this.requireMembership(organizationId, userId);
    if (access.membership.role !== "admin") {
      throw new ForbiddenException("Only organization admins can manage that resource.");
    }
    return access;
  }

  private ensureVerifiedEmail(user: AuthenticatedUser) {
    if (user.emailVerified !== true || !this.normalizeEmail(user.email)) {
      throw new ForbiddenException(
        "A verified email address is required for this action."
      );
    }
  }

  private async ensureUserProfile(user: AuthenticatedUser) {
    const email = this.normalizeEmail(user.email);
    if (!email) return null;

    const values = {
      email,
      firstName: this.trimOptional(user.firstName),
      lastName: this.trimOptional(user.lastName),
      emailVerified: user.emailVerified,
      updatedAt: new Date(),
    };

    const [profile] = await this.db
      .insert(authUserProfiles)
      .values({ userId: user.id, ...values })
      .onConflictDoUpdate({
        target: authUserProfiles.userId,
        set: values,
      })
      .returning();

    return profile;
  }

  private async countMembers(organizationId: string) {
    const [row] = await this.db
      .select({ total: count() })
      .from(authOrganizationMemberships)
      .where(eq(authOrganizationMemberships.organizationId, organizationId));
    return Number(row?.total ?? 0);
  }

  private normalizeName(value: string | undefined | null) {
    const name = value?.trim();
    if (!name) throw new BadRequestException("Organization name is required.");
    return name;
  }

  private normalizeEmail(value: string | undefined | null) {
    const normalized = value?.trim().toLowerCase();
    return normalized ? normalized : null;
  }

  private normalizeRequiredEmail(value: string | undefined | null) {
    const normalized = this.normalizeEmail(value);
    if (!normalized) throw new BadRequestException("A valid email is required.");
    return normalized;
  }

  private trimOptional(value: string | undefined | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private mapOrganizationSummary(organization: OrganizationRecord) {
    return {
      id: organization.id,
      name: organization.name,
      status: organization.status,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
    };
  }

  private mapOrganizationDetail(organization: OrganizationRecord) {
    return {
      ...this.mapOrganizationSummary(organization),
      createdBy: organization.createdBy,
    };
  }

  private mapInvite(invite: typeof authOrganizationInvites.$inferSelect) {
    return {
      id: invite.id,
      organizationId: invite.organizationId,
      invitedEmail: invite.invitedEmail,
      role: invite.role,
      status: invite.status,
      invitedBy: invite.invitedBy,
      acceptedBy: invite.acceptedBy,
      acceptedAt: toIso(invite.acceptedAt),
      revokedAt: toIso(invite.revokedAt),
      createdAt: invite.createdAt.toISOString(),
      updatedAt: invite.updatedAt.toISOString(),
    };
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
}
