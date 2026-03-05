import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { type Database, memberProfiles } from "@booktrack/db";
import { and, eq, ne } from "drizzle-orm";
import type { AuthenticatedUser } from "../../common/guards";
import { UpdateProfileDto } from "./dto";

@Injectable()
export class ProfilesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async sync(user: AuthenticatedUser) {
    const existing = await this.db.query.memberProfiles.findFirst({
      where: eq(memberProfiles.userId, user.id),
    });

    if (existing) return existing;

    const username = await this.getUniqueUsername(this.getBaseUsername(user));
    const displayName =
      user.name?.trim() ||
      (user.email ? user.email.split("@")[0] : null) ||
      username;

    const [created] = await this.db
      .insert(memberProfiles)
      .values({
        userId: user.id,
        username,
        displayName,
      })
      .returning();

    return created;
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

    if (dto.username && dto.username !== existing.username) {
      const username = this.normalizeUsername(dto.username);
      const taken = await this.db.query.memberProfiles.findFirst({
        where: and(
          eq(memberProfiles.username, username),
          ne(memberProfiles.userId, user.id)
        ),
      });
      if (taken) {
        throw new ConflictException("Username is already taken");
      }
      updates.username = username;
    }

    if (dto.displayName !== undefined) updates.displayName = dto.displayName;
    if (dto.cityArea !== undefined) updates.cityArea = dto.cityArea;
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

  private getBaseUsername(user: AuthenticatedUser) {
    const preferred =
      user.username ||
      user.email?.split("@")[0] ||
      user.name ||
      `user_${user.id.slice(0, 8)}`;
    return this.normalizeUsername(preferred);
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

  private async getUniqueUsername(base: string) {
    const candidate = base.length >= 3 ? base : `${base}_user`;
    let finalCandidate = candidate.slice(0, 50);
    let suffix = 1;

    while (true) {
      const exists = await this.db.query.memberProfiles.findFirst({
        where: eq(memberProfiles.username, finalCandidate),
      });
      if (!exists) return finalCandidate;

      const suffixText = `_${suffix}`;
      finalCandidate = `${candidate.slice(0, 50 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }
  }
}
