import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
  type DeactivateAccountDto,
  type DeleteAccountDto,
  type UpdateEmailDto,
  type UpdateIdentityProfileDto,
  type UpdatePasswordDto,
  type UpdateProfileDto,
  type IdentityGenderValue,
} from "./dto";

interface IdentityProfileSnapshot {
  email: string;
  firstName: string | null;
  lastName: string | null;
  gender: IdentityGenderValue | null;
}

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly configService: ConfigService
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
