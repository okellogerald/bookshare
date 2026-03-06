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
    const username =
      existing?.username?.trim().length
        ? existing.username
        : await this.getUniqueUsername(baseUsername, user.id);
    const firstName = shouldSyncIdentityFromClaims
      ? (user.firstName ?? existing?.firstName ?? null)
      : (existing?.firstName ?? null);
    const lastName = shouldSyncIdentityFromClaims
      ? (user.lastName ?? existing?.lastName ?? null)
      : (existing?.lastName ?? null);
    const claimGender = this.normalizeGender(user.gender);
    const displayName = this.composeDisplayName(firstName, lastName, username);

    const identityUpdates = {
      username,
      displayName,
      firstName,
      lastName,
      nickname: null,
      gender: shouldSyncIdentityFromClaims
        ? (claimGender ?? existing?.gender ?? null)
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
    zitadelAccessToken: string | undefined,
    dto: UpdateIdentityProfileDto
  ) {
    this.extractBearerToken(authorization);
    const token = this.extractTokenForZitadel(authorization, zitadelAccessToken);
    const existing = await this.findMe(user);

    const usernameInput = (dto.username ?? existing.username ?? "").trim();
    const firstName = (dto.firstName ?? existing.firstName ?? "").trim();
    const lastName = (dto.lastName ?? existing.lastName ?? "").trim();
    const username = await this.ensureUniqueUsername(usernameInput, user.id);
    const displayName = this.composeDisplayName(firstName, lastName, username);
    const gender = this.normalizeGender(dto.gender ?? existing.gender ?? undefined);

    if (!username) {
      throw new BadRequestException("username is required");
    }
    if (!firstName) {
      throw new BadRequestException("firstName is required");
    }
    if (!lastName) {
      throw new BadRequestException("lastName is required");
    }

    const payload = {
      firstName,
      lastName,
      displayName,
      gender,
    };

    await this.updateZitadelMyProfile(token, payload);

    const [updated] = await this.db
      .update(memberProfiles)
      .set({
        username,
        firstName,
        lastName,
        displayName,
        nickname: null,
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

  private composeDisplayName(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
    username: string
  ) {
    const fullName = [firstName, lastName]
      .filter((value): value is string => !!value && value.trim().length > 0)
      .join(" ")
      .trim();
    return fullName || username;
  }

  private normalizeUsername(value: string, fallback = "member") {
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!normalized) return fallback;
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

  private async ensureUniqueUsername(value: string, userId: string) {
    if (value.trim().length === 0) {
      throw new BadRequestException("username is required");
    }

    const normalized = this.normalizeUsername(value, "");
    if (!normalized) {
      throw new BadRequestException(
        "username must include at least one letter or number"
      );
    }
    if (normalized.length < 3) {
      throw new BadRequestException(
        "username must be at least 3 characters after normalization"
      );
    }

    const existing = await this.db.query.memberProfiles.findFirst({
      where: eq(memberProfiles.username, normalized),
    });

    if (existing && existing.userId !== userId) {
      throw new BadRequestException("username is already taken");
    }

    return normalized;
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

  private isZitadelNoopProfileUpdate(status: number, errorText: string) {
    if (status !== 400) return false;
    const normalizedError = errorText.toLowerCase();
    return normalizedError.includes("profile not changed");
  }

  private async updateZitadelMyProfile(
    token: string,
    payload: {
      firstName: string;
      lastName: string;
      displayName: string;
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
    if (this.isZitadelNoopProfileUpdate(response.status, primaryErrorText)) {
      return;
    }

    const fallbackResponse = await fetch(`${issuerInternal}/v2/users/me`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        profile: {
          givenName: payload.firstName,
          familyName: payload.lastName,
          displayName: payload.displayName,
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
