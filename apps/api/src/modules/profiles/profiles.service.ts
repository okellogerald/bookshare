import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { type Database, memberProfiles } from "@booktrack/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedUser } from "../../common/guards";
import {
  type UpdateIdentityProfileDto,
  type UpdateProfileDto,
  type ZitadelGenderValue,
} from "./dto";

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly configService: ConfigService
  ) {}

  async sync(user: AuthenticatedUser) {
    const existing = await this.db.query.memberProfiles.findFirst({
      where: eq(memberProfiles.userId, user.id),
    });

    const tokenIssuedAtDate = user.tokenIssuedAt
      ? new Date(user.tokenIssuedAt * 1000)
      : null;
    const shouldSyncIdentityFromClaims =
      !existing ||
      !tokenIssuedAtDate ||
      existing.identityUpdatedAt <= tokenIssuedAtDate;

    const baseUsername = this.getBaseUsername(user);
    const identityUsername = await this.getUniqueUsername(baseUsername, user.id);
    const username =
      existing && existing.username !== identityUsername
        ? identityUsername
        : (existing?.username ?? identityUsername);
    const claimDisplayName = this.getDisplayName(user, username, existing?.displayName);
    const displayName = shouldSyncIdentityFromClaims
      ? claimDisplayName
      : (existing?.displayName ?? claimDisplayName);

    const identityUpdates = {
      username,
      displayName,
      firstName: shouldSyncIdentityFromClaims
        ? (user.firstName ?? null)
        : (existing?.firstName ?? null),
      lastName: shouldSyncIdentityFromClaims
        ? (user.lastName ?? null)
        : (existing?.lastName ?? null),
      nickname: shouldSyncIdentityFromClaims
        ? (user.nickname ?? null)
        : (existing?.nickname ?? null),
      gender: shouldSyncIdentityFromClaims
        ? (user.gender ?? null)
        : (existing?.gender ?? null),
      identityUpdatedAt: shouldSyncIdentityFromClaims
        ? new Date()
        : (existing?.identityUpdatedAt ?? new Date()),
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

  async findMe(user: AuthenticatedUser) {
    const profile = await this.db.query.memberProfiles.findFirst({
      where: eq(memberProfiles.userId, user.id),
    });

    if (profile) return profile;
    return this.sync(user);
  }

  async updateMe(user: AuthenticatedUser, dto: UpdateProfileDto) {
    const existing = await this.findMe(user);
    const updates: Record<string, unknown> = {};

    if (dto.cityArea !== undefined) {
      updates.cityArea = dto.cityArea;
    }
    if (dto.contactHandle !== undefined) {
      updates.contactHandle = dto.contactHandle;
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
    zitadelAccessToken: string | undefined,
    dto: UpdateIdentityProfileDto
  ) {
    this.extractBearerToken(authorization);
    const token = this.extractTokenForZitadel(authorization, zitadelAccessToken);
    const existing = await this.findMe(user);

    const firstName = (dto.firstName ?? existing.firstName ?? "").trim();
    const lastName = (dto.lastName ?? existing.lastName ?? "").trim();
    const displayName = (dto.displayName ?? existing.displayName ?? "").trim();
    const nickname = dto.nickname !== undefined
      ? dto.nickname.trim()
      : (existing.nickname ?? "");
    const gender = this.normalizeGender(dto.gender ?? existing.gender ?? undefined);

    if (!firstName) {
      throw new BadRequestException("firstName is required");
    }
    if (!lastName) {
      throw new BadRequestException("lastName is required");
    }
    if (!displayName) {
      throw new BadRequestException("displayName is required");
    }

    const payload = {
      firstName,
      lastName,
      displayName,
      nickName: nickname || undefined,
      gender,
    };

    await this.updateZitadelMyProfile(token, payload);

    const [updated] = await this.db
      .update(memberProfiles)
      .set({
        firstName,
        lastName,
        displayName,
        nickname: nickname || null,
        gender: gender ?? null,
        identityUpdatedAt: new Date(),
      })
      .where(eq(memberProfiles.userId, user.id))
      .returning();

    if (!updated) throw new NotFoundException("Profile not found");
    return updated;
  }

  private getBaseUsername(user: AuthenticatedUser) {
    const preferred =
      user.nickname ||
      user.username ||
      user.email?.split("@")[0] ||
      user.name ||
      `user_${user.id.slice(0, 8)}`;
    return this.normalizeUsername(preferred);
  }

  private getDisplayName(
    user: AuthenticatedUser,
    username: string,
    existingDisplayName?: string
  ) {
    const fullName = [user.firstName, user.lastName]
      .filter((value): value is string => !!value && value.trim().length > 0)
      .join(" ")
      .trim();
    return (
      user.name?.trim() ||
      fullName ||
      user.nickname?.trim() ||
      existingDisplayName ||
      username
    );
  }

  private normalizeUsername(value: string) {
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!normalized) return "member";
    return normalized.slice(0, 50);
  }

  private async getUniqueUsername(base: string, userId?: string) {
    const candidate = base.length >= 3 ? base : `${base}_user`;
    let finalCandidate = candidate.slice(0, 50);
    let suffix = 1;

    while (true) {
      const exists = await this.db.query.memberProfiles.findFirst({
        where: eq(memberProfiles.username, finalCandidate),
      });
      if (!exists || (userId && exists.userId === userId)) return finalCandidate;

      const suffixText = `_${suffix}`;
      finalCandidate = `${candidate.slice(0, 50 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }
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

  private extractTokenForZitadel(
    authorization: string | undefined,
    zitadelAccessToken: string | undefined
  ) {
    if (zitadelAccessToken && zitadelAccessToken.trim().length > 0) {
      return zitadelAccessToken.trim();
    }
    return this.extractBearerToken(authorization);
  }

  private normalizeGender(value: string | undefined): ZitadelGenderValue | undefined {
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
    if (normalized === "GENDER_DIVERSE" || normalized === "DIVERSE") {
      return "GENDER_DIVERSE";
    }

    return "GENDER_UNSPECIFIED";
  }

  private async updateZitadelMyProfile(
    token: string,
    payload: {
      firstName: string;
      lastName: string;
      displayName: string;
      nickName?: string;
      gender?: ZitadelGenderValue;
    }
  ) {
    const issuer = this.configService.getOrThrow<string>("ZITADEL_ISSUER");
    const issuerInternal =
      this.configService.get<string>("ZITADEL_ISSUER_INTERNAL") || issuer;
    const issuerHost = new URL(issuer).host;

    const headers = new Headers({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    });

    if (issuerInternal !== issuer) {
      headers.set("host", issuerHost);
    }

    const response = await fetch(`${issuerInternal}/auth/v1/users/me/profile`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });

    if (response.ok) return;

    const primaryErrorText = await response.text();
    const fallbackResponse = await fetch(`${issuerInternal}/v2/users/me`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        profile: {
          givenName: payload.firstName,
          familyName: payload.lastName,
          displayName: payload.displayName,
          nickName: payload.nickName,
          gender: payload.gender,
        },
      }),
    });

    if (fallbackResponse.ok) return;

    const fallbackErrorText = await fallbackResponse.text();
    throw new BadGatewayException(
      `Failed to update identity in Zitadel (auth/v1: ${response.status}, v2: ${fallbackResponse.status}) primary=${primaryErrorText} fallback=${fallbackErrorText}`
    );
  }
}
