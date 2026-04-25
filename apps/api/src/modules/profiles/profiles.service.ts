import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthorizationService } from "../../common/authorization/authorization.service";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import {
  type Database,
  bookQuotes,
  collections,
  copies,
  memberProfiles,
  wants,
} from "@bookshare/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedUser } from "../../common/guards";
import {
  type AdminPasswordResetDto,
  type DeactivateAccountDto,
  type DeleteAccountDto,
  type UpdateEmailDto,
  type UpdateIdentityProfileDto,
  type UpdatePasswordDto,
  type UpdateProfileDto,
  type IdentityGenderValue,
} from "./dto";
import {
  AuthorizationPermission,
  createPlatformScope,
} from "@bookshare/shared";

interface IdentityProfileSnapshot {
  email: string;
  firstName: string | null;
  lastName: string | null;
  gender: IdentityGenderValue | null;
}

interface KratosIdentityRecord {
  id: string;
  schema_id?: string;
  state?: string;
  traits?: Record<string, unknown> | null;
  verifiable_addresses?: unknown;
  recovery_addresses?: unknown;
  metadata_public?: unknown;
  metadata_admin?: unknown;
}

export interface AdminPasswordResetResult {
  ok: true;
  userId: string;
  recoveryCode: string | null;
  recoveryLink: string | null;
  expiresAt: string | null;
}

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly configService: ConfigService,
    private readonly authorizationService: AuthorizationService
  ) {}

  async sync(
    user: AuthenticatedUser,
    authorization?: string,
    identityAccessToken?: string
  ) {
    const existing = await this.db.query.memberProfiles.findFirst({
      where: eq(memberProfiles.userId, user.id),
    });

    if (existing?.deactivatedAt) {
      throw new UnauthorizedException("Account is deactivated");
    }

    const identityProfile = await this.resolveIdentityProfile(
      user,
      existing,
      authorization,
      identityAccessToken
    );

    const identityUpdates = {
      email: identityProfile.email,
      firstName: identityProfile.firstName,
      lastName: identityProfile.lastName,
      gender: identityProfile.gender,
      identityUpdatedAt: new Date(),
    };

    if (!existing) {
      const [created] = await this.db
        .insert(memberProfiles)
        .values({
          userId: user.id,
          ...identityUpdates,
        })
        .returning();

      return created;
    }

    const [updated] = await this.db
      .update(memberProfiles)
      .set(identityUpdates)
      .where(eq(memberProfiles.userId, user.id))
      .returning();

    if (!updated) throw new NotFoundException("Profile not found");
    return updated;
  }

  async findMe(
    user: AuthenticatedUser,
    authorization?: string,
    identityAccessToken?: string
  ) {
    const profile = await this.db.query.memberProfiles.findFirst({
      where: eq(memberProfiles.userId, user.id),
    });

    if (profile?.deactivatedAt) {
      throw new UnauthorizedException("Account is deactivated");
    }

    if (profile) return profile;
    return this.sync(user, authorization, identityAccessToken);
  }

  async updateMe(
    user: AuthenticatedUser,
    dto: UpdateProfileDto,
    authorization?: string,
    identityAccessToken?: string
  ) {
    const existing = await this.findMe(user, authorization, identityAccessToken);
    const updates: Record<string, unknown> = {};

    if (dto.location !== undefined) {
      updates.location = this.normalizeText(dto.location);
    }
    if (dto.contactNotes !== undefined) {
      updates.contactNotes = this.normalizeText(dto.contactNotes);
    }
    if (dto.avatarUrl !== undefined) {
      const normalizedAvatarUrl =
        typeof dto.avatarUrl === "string" && dto.avatarUrl.trim().length > 0
          ? dto.avatarUrl.trim()
          : null;
      updates.avatarUrl = normalizedAvatarUrl;
    }

    if (Object.keys(updates).length === 0) return existing;

    const [updated] = await this.db
      .update(memberProfiles)
      .set(updates as any)
      .where(eq(memberProfiles.userId, user.id))
      .returning();

    if (!updated) throw new NotFoundException("Profile not found");
    return updated;
  }

  async updateMyIdentity(
    user: AuthenticatedUser,
    authorization: string | undefined,
    identityAccessToken: string | undefined,
    dto: UpdateIdentityProfileDto
  ) {
    this.extractBearerToken(authorization);
    void identityAccessToken;
    void dto;
    throw new BadRequestException(
      "Identity details must be updated through the Ory Kratos settings flow."
    );
  }

  async updateMyEmail(
    user: AuthenticatedUser,
    authorization: string | undefined,
    identityAccessToken: string | undefined,
    dto: UpdateEmailDto
  ) {
    this.extractBearerToken(authorization);
    void user;
    void identityAccessToken;
    void dto;
    throw new BadRequestException(
      "Email changes must be completed through the Ory Kratos settings flow."
    );
  }

  async updateMyPassword(
    _user: AuthenticatedUser,
    authorization: string | undefined,
    _identityAccessToken: string | undefined,
    dto: UpdatePasswordDto
  ) {
    this.extractBearerToken(authorization);

    const oldPassword = dto.oldPassword.trim();
    const newPassword = dto.newPassword.trim();

    if (!oldPassword || !newPassword) {
      throw new BadRequestException("oldPassword and newPassword are required");
    }
    if (oldPassword === newPassword) {
      throw new BadRequestException("newPassword must be different from oldPassword");
    }

    throw new BadRequestException(
      "Password changes must be completed through the Ory Kratos settings flow."
    );
  }

  async deactivateMyAccount(
    user: AuthenticatedUser,
    authorization: string | undefined,
    identityAccessToken: string | undefined,
    dto: DeactivateAccountDto
  ) {
    this.extractBearerToken(authorization);

    if (!dto.password.trim()) {
      throw new BadRequestException("password is required");
    }

    await this.findMe(user, authorization, identityAccessToken);

    const deactivatedAt = new Date();
    const [updated] = await this.db
      .update(memberProfiles)
      .set({ deactivatedAt })
      .where(eq(memberProfiles.userId, user.id))
      .returning({
        userId: memberProfiles.userId,
        deactivatedAt: memberProfiles.deactivatedAt,
      });

    if (!updated) {
      throw new NotFoundException("Profile not found");
    }

    return {
      deactivated: true,
      deactivatedAt: updated.deactivatedAt,
      identityProviderDeactivated: false,
    };
  }

  async deleteMyAccount(
    user: AuthenticatedUser,
    authorization: string | undefined,
    _identityAccessToken: string | undefined,
    dto: DeleteAccountDto
  ) {
    this.extractBearerToken(authorization);

    if (!dto.password.trim()) {
      throw new BadRequestException("password is required");
    }

    await this.deleteLocalAccountData(user.id);

    return { deleted: true };
  }

  async createAdminPasswordReset(
    actor: AuthenticatedUser,
    userId: string,
    dto: AdminPasswordResetDto = {}
  ): Promise<AdminPasswordResetResult> {
    this.authorizationService.assertPermission(
      actor,
      AuthorizationPermission.IDENTITY_PASSWORD_RESET,
      createPlatformScope()
    );

    const targetUserId = this.normalizeUserId(userId);
    await this.requireMemberProfile(targetUserId);

    const recovery = await this.createKratosRecoveryCode(
      targetUserId,
      dto.expiresIn
    );

    return {
      ok: true,
      userId: targetUserId,
      recoveryCode: recovery.recoveryCode,
      recoveryLink: recovery.recoveryLink,
      expiresAt: recovery.expiresAt,
    };
  }

  async deactivateMemberAccount(actor: AuthenticatedUser, userId: string) {
    this.authorizationService.assertPermission(
      actor,
      AuthorizationPermission.IDENTITY_ACCOUNT_DEACTIVATE,
      createPlatformScope()
    );

    const targetUserId = this.normalizeUserId(userId);
    this.assertNotSelf(actor, targetUserId, "deactivate your own account");
    await this.requireMemberProfile(targetUserId);

    await this.updateKratosIdentityState(targetUserId, "inactive");

    const deactivatedAt = new Date();
    const [updated] = await this.db
      .update(memberProfiles)
      .set({ deactivatedAt, identityUpdatedAt: new Date() })
      .where(eq(memberProfiles.userId, targetUserId))
      .returning({
        userId: memberProfiles.userId,
        deactivatedAt: memberProfiles.deactivatedAt,
      });

    if (!updated) {
      throw new NotFoundException("Member profile not found.");
    }

    const sessionsRevoked = await this.revokeKratosIdentitySessions(targetUserId, {
      throwOnFailure: false,
    });

    return {
      ok: true,
      userId: updated.userId,
      status: "deactivated",
      deactivatedAt: updated.deactivatedAt,
      sessionsRevoked,
    };
  }

  async reactivateMemberAccount(actor: AuthenticatedUser, userId: string) {
    this.authorizationService.assertPermission(
      actor,
      AuthorizationPermission.IDENTITY_ACCOUNT_REACTIVATE,
      createPlatformScope()
    );

    const targetUserId = this.normalizeUserId(userId);
    await this.requireMemberProfile(targetUserId);

    await this.updateKratosIdentityState(targetUserId, "active");

    const [updated] = await this.db
      .update(memberProfiles)
      .set({ deactivatedAt: null, identityUpdatedAt: new Date() })
      .where(eq(memberProfiles.userId, targetUserId))
      .returning({
        userId: memberProfiles.userId,
        deactivatedAt: memberProfiles.deactivatedAt,
      });

    if (!updated) {
      throw new NotFoundException("Member profile not found.");
    }

    return {
      ok: true,
      userId: updated.userId,
      status: "active",
      deactivatedAt: updated.deactivatedAt,
    };
  }

  async revokeMemberSessions(actor: AuthenticatedUser, userId: string) {
    this.authorizationService.assertPermission(
      actor,
      AuthorizationPermission.IDENTITY_SESSIONS_REVOKE,
      createPlatformScope()
    );

    const targetUserId = this.normalizeUserId(userId);
    this.assertNotSelf(actor, targetUserId, "revoke your own sessions");
    await this.requireMemberProfile(targetUserId);
    await this.revokeKratosIdentitySessions(targetUserId, {
      throwOnFailure: true,
    });

    return {
      ok: true,
      userId: targetUserId,
      sessionsRevoked: true,
    };
  }

  private normalizeText(value: string | null | undefined) {
    if (!value) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeEmail(value: string | null | undefined) {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private async resolveIdentityProfile(
    user: AuthenticatedUser,
    existing:
      | {
          email: string;
          firstName: string | null;
          lastName: string | null;
          gender: string | null;
        }
      | null
      | undefined,
    authorization: string | undefined,
    identityAccessToken: string | undefined
  ): Promise<IdentityProfileSnapshot> {
    const kratosProfile = await this.fetchIdentityProfileFromKratos(user.id);
    if (kratosProfile?.email) {
      return kratosProfile;
    }

    const email =
      this.normalizeEmail(user.email) ??
      this.normalizeEmail(existing?.email) ??
      (await this.fetchEmailFromUserInfo(authorization, identityAccessToken));

    if (!email) {
      throw new UnauthorizedException(
        "Could not resolve your email from identity provider. Please sign out and sign in again."
      );
    }

    return {
      email,
      firstName:
        this.normalizeText(user.firstName) ?? this.normalizeText(existing?.firstName),
      lastName:
        this.normalizeText(user.lastName) ?? this.normalizeText(existing?.lastName),
      gender:
        this.normalizeGender(user.gender ?? existing?.gender ?? undefined) ?? null,
    };
  }

  private extractBearerToken(authorization: string | undefined) {
    if (!authorization) {
      throw new UnauthorizedException("No authorization token provided");
    }

    const [type, token] = authorization.split(" ");
    if (type !== "Bearer" || !token) {
      throw new UnauthorizedException("Invalid authorization token");
    }

    return token;
  }

  private extractBearerTokenIfPresent(authorization: string | undefined) {
    if (!authorization) return null;

    const [type, token] = authorization.split(" ");
    if (type !== "Bearer" || !token) {
      return null;
    }

    return token;
  }

  private getIdentityProviderEndpoints() {
    const issuer = this.configService.getOrThrow<string>("OIDC_ISSUER");
    const issuerInternal =
      this.configService.get<string>("OIDC_ISSUER_INTERNAL") || issuer;
    const issuerHost = new URL(issuer).host;
    const configuredUserInfoEndpoint = this.configService.get<string>(
      "OIDC_USERINFO_ENDPOINT"
    );
    const userInfoEndpoint = configuredUserInfoEndpoint
      ? new URL(configuredUserInfoEndpoint, issuerInternal).toString()
      : new URL("/userinfo", issuerInternal).toString();

    return {
      issuer,
      issuerInternal,
      issuerHost,
      userInfoEndpoint,
    };
  }

  private createIdentityProviderHeaders(token: string, includeJson = false) {
    const { issuer, issuerInternal, issuerHost } =
      this.getIdentityProviderEndpoints();

    const headers = new Headers({
      Authorization: `Bearer ${token}`,
    });

    if (includeJson) {
      headers.set("Content-Type", "application/json");
    }

    if (issuerInternal !== issuer) {
      headers.set("host", issuerHost);
    }

    return {
      issuerInternal,
      headers,
    };
  }

  private async fetchEmailFromUserInfo(
    authorization: string | undefined,
    identityAccessToken: string | undefined
  ) {
    const token =
      identityAccessToken?.trim() || this.extractBearerTokenIfPresent(authorization);
    if (!token) return null;

    const { userInfoEndpoint } = this.getIdentityProviderEndpoints();
    const { headers } = this.createIdentityProviderHeaders(token);

    const response = await fetch(userInfoEndpoint, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { email?: string };
    return this.normalizeEmail(payload.email);
  }

  private getKratosAdminUrl() {
    return this.configService.get<string>("KRATOS_ADMIN_URL") || "http://kratos:4434";
  }

  private normalizeUserId(userId: string) {
    const normalized = userId.trim();
    if (!normalized) {
      throw new BadRequestException("userId is required");
    }
    return normalized;
  }

  private assertNotSelf(
    actor: AuthenticatedUser,
    targetUserId: string,
    action: string
  ) {
    if (actor.id === targetUserId) {
      throw new ForbiddenException(`You cannot ${action}.`);
    }
  }

  private async requireMemberProfile(userId: string) {
    const profile = await this.db.query.memberProfiles.findFirst({
      columns: {
        userId: true,
        email: true,
        deactivatedAt: true,
      },
      where: eq(memberProfiles.userId, userId),
    });

    if (!profile) {
      throw new NotFoundException("Member profile not found.");
    }

    return profile;
  }

  private async getKratosIdentity(userId: string): Promise<KratosIdentityRecord> {
    const url = new URL(
      `/admin/identities/${encodeURIComponent(userId)}`,
      this.getKratosAdminUrl()
    );

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (response.status === 404) {
      throw new NotFoundException("Identity not found in Kratos.");
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Failed to load Kratos identity (status ${response.status}).`
      );
    }

    return (await response.json()) as KratosIdentityRecord;
  }

  private buildKratosIdentityUpdateBody(
    identity: KratosIdentityRecord,
    state: "active" | "inactive"
  ) {
    return {
      schema_id: identity.schema_id ?? "default",
      state,
      traits: identity.traits ?? {},
      verifiable_addresses: identity.verifiable_addresses,
      recovery_addresses: identity.recovery_addresses,
      metadata_public: identity.metadata_public,
      metadata_admin: identity.metadata_admin,
    };
  }

  private async updateKratosIdentityState(
    userId: string,
    state: "active" | "inactive"
  ) {
    const identity = await this.getKratosIdentity(userId);
    const url = new URL(
      `/admin/identities/${encodeURIComponent(userId)}`,
      this.getKratosAdminUrl()
    );
    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.buildKratosIdentityUpdateBody(identity, state)),
    });

    if (response.status === 404) {
      throw new NotFoundException("Identity not found in Kratos.");
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Failed to update Kratos identity state (status ${response.status}).`
      );
    }
  }

  private normalizeExpiresIn(value: string | undefined) {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : "1h";
  }

  private async createKratosRecoveryCode(
    userId: string,
    expiresIn: string | undefined
  ) {
    const url = new URL("/admin/recovery/code", this.getKratosAdminUrl());
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identity_id: userId,
        expires_in: this.normalizeExpiresIn(expiresIn),
        flow_type: "browser",
      }),
    });

    if (response.status === 404) {
      throw new NotFoundException("Identity not found in Kratos.");
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Failed to create Kratos recovery code (status ${response.status}).`
      );
    }

    const payload = (await response.json()) as {
      recovery_code?: unknown;
      recovery_link?: unknown;
      expires_at?: unknown;
    };

    return {
      recoveryCode:
        typeof payload.recovery_code === "string" ? payload.recovery_code : null,
      recoveryLink:
        typeof payload.recovery_link === "string" ? payload.recovery_link : null,
      expiresAt:
        typeof payload.expires_at === "string" ? payload.expires_at : null,
    };
  }

  private async revokeKratosIdentitySessions(
    userId: string,
    options: { throwOnFailure: boolean }
  ) {
    const url = new URL(
      `/admin/identities/${encodeURIComponent(userId)}/sessions`,
      this.getKratosAdminUrl()
    );

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (response.ok || response.status === 204) {
      return true;
    }

    if (options.throwOnFailure) {
      if (response.status === 404) {
        throw new NotFoundException("Identity not found in Kratos.");
      }

      throw new InternalServerErrorException(
        `Failed to revoke Kratos sessions (status ${response.status}).`
      );
    }

    return false;
  }

  private async fetchIdentityProfileFromKratos(
    userId: string
  ): Promise<IdentityProfileSnapshot | null> {
    const baseUrl = this.getKratosAdminUrl();
    const url = new URL(`/admin/identities/${encodeURIComponent(userId)}`, baseUrl);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as {
        traits?: {
          email?: unknown;
          gender?: unknown;
          name?: {
            first?: unknown;
            last?: unknown;
          } | null;
        } | null;
      };

      const traits =
        payload.traits && typeof payload.traits === "object" ? payload.traits : null;
      const name =
        traits?.name && typeof traits.name === "object" ? traits.name : null;
      const email = this.normalizeEmail(
        typeof traits?.email === "string" ? traits.email : null
      );

      if (!email) {
        return null;
      }

      return {
        email,
        firstName: this.normalizeText(
          typeof name?.first === "string" ? name.first : null
        ),
        lastName: this.normalizeText(
          typeof name?.last === "string" ? name.last : null
        ),
        gender:
          this.normalizeGender(
            typeof traits?.gender === "string" ? traits.gender : undefined
          ) ?? null,
      };
    } catch {
      return null;
    }
  }

  private normalizeGender(
    value: string | undefined
  ): IdentityGenderValue | undefined {
    if (!value) return undefined;
    const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");

    if (normalized === "GENDER_UNSPECIFIED" || normalized === "UNSPECIFIED") {
      return "GENDER_UNSPECIFIED";
    }
    if (normalized === "GENDER_FEMALE" || normalized === "FEMALE") {
      return "GENDER_FEMALE";
    }
    if (normalized === "GENDER_MALE" || normalized === "MALE") {
      return "GENDER_MALE";
    }
    if (
      normalized === "PREFER_NOT_TO_SAY" ||
      normalized === "GENDER_PREFER_NOT_TO_SAY"
    ) {
      return "GENDER_UNSPECIFIED";
    }
    return "GENDER_UNSPECIFIED";
  }

  private async deleteLocalAccountData(userId: string) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(wants)
        .set({ fulfilledByUserId: null } as any)
        .where(eq(wants.fulfilledByUserId, userId));
      await tx.delete(bookQuotes).where(eq(bookQuotes.addedBy, userId));
      await tx.delete(collections).where(eq(collections.userId, userId));
      await tx.delete(wants).where(eq(wants.userId, userId));
      await tx.delete(copies).where(eq(copies.userId, userId));
      await tx.delete(memberProfiles).where(eq(memberProfiles.userId, userId));
    });
  }
}
