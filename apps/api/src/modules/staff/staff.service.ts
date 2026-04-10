import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { type Database, staffRoles } from "@bookshare/db";
import { UserRole } from "@bookshare/shared";
import { and, asc, count, desc, eq } from "drizzle-orm";
import type { AuthenticatedUser } from "../../common/guards";
import type { ManageStaffRoleDto } from "./dto";

export interface StaffIdentity {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  emailVerified: boolean;
  state: string | null;
}

export interface StaffDirectoryEntry extends StaffIdentity {
  roles: Array<{
    role: string;
    grantedBy: string | null;
    createdAt: string;
  }>;
}

export interface StaffIdentitySearchResult extends StaffIdentity {
  existingRoles: string[];
}

interface KratosIdentityRecord {
  id: string;
  state?: unknown;
  traits?: {
    email?: unknown;
    name?: {
      first?: unknown;
      last?: unknown;
    } | null;
  } | null;
  verifiable_addresses?: Array<{
    value?: unknown;
    verified?: unknown;
  }> | null;
}

@Injectable()
export class StaffService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly configService: ConfigService
  ) {}

  async listDirectory(query?: string) {
    const normalizedQuery = this.normalizeQuery(query);
    const assignments = await this.db
      .select({
        userId: staffRoles.userId,
        role: staffRoles.role,
        grantedBy: staffRoles.grantedBy,
        createdAt: staffRoles.createdAt,
      })
      .from(staffRoles)
      .orderBy(asc(staffRoles.userId), asc(staffRoles.role), desc(staffRoles.createdAt));

    const userIds = Array.from(new Set(assignments.map((entry) => entry.userId)));
    const identities = new Map<string, StaffIdentity>();

    await Promise.all(
      userIds.map(async (userId) => {
        const identity = await this.fetchIdentity(userId);
        if (identity) {
          identities.set(userId, identity);
        }
      })
    );

    const directory = new Map<string, StaffDirectoryEntry>();

    for (const assignment of assignments) {
      const identity =
        identities.get(assignment.userId) ?? this.fallbackIdentity(assignment.userId);

      const existing =
        directory.get(assignment.userId) ??
        ({
          ...identity,
          roles: [],
        } satisfies StaffDirectoryEntry);

      existing.roles.push({
        role: assignment.role,
        grantedBy: assignment.grantedBy,
        createdAt: assignment.createdAt.toISOString(),
      });

      directory.set(assignment.userId, existing);
    }

    const entries = Array.from(directory.values())
      .filter((entry) => this.matchesIdentityQuery(entry, normalizedQuery))
      .sort((left, right) =>
        left.displayName.localeCompare(right.displayName, undefined, {
          sensitivity: "base",
        })
      );

    return entries;
  }

  async searchIdentities(query?: string) {
    const normalizedQuery = this.normalizeQuery(query);
    if (normalizedQuery.length < 2) {
      return [];
    }

    const identities = await this.fetchIdentities();
    const persistedRoles = await this.loadRoleMap();
    const bootstrapEmails = this.parseBootstrapEmails();

    return identities
      .filter((identity) => this.matchesIdentityQuery(identity, normalizedQuery))
      .map((identity) => {
        const existingRoles = new Set(persistedRoles.get(identity.userId) ?? []);
        if (identity.email && bootstrapEmails.has(identity.email)) {
          existingRoles.add(UserRole.OWNER);
        }

        return {
          ...identity,
          existingRoles: Array.from(existingRoles).sort(),
        } satisfies StaffIdentitySearchResult;
      })
      .sort((left, right) =>
        this.compareIdentitySearchResults(left.displayName, right.displayName)
      )
      .slice(0, 12);
  }

  async grantRole(user: AuthenticatedUser, dto: ManageStaffRoleDto) {
    this.ensureCanManageRole(user.roles, dto.role);

    const existing = await this.db.query.staffRoles.findFirst({
      where: and(
        eq(staffRoles.userId, dto.userId),
        eq(staffRoles.role, dto.role)
      ),
    });

    if (existing) {
      throw new ConflictException("That staff role is already assigned.");
    }

    const identity = await this.fetchIdentity(dto.userId);
    if (!identity) {
      throw new NotFoundException("The target identity could not be found.");
    }

    await this.db.insert(staffRoles).values({
      userId: dto.userId,
      role: dto.role,
      grantedBy: user.id,
    });

    return {
      ok: true,
      userId: dto.userId,
      role: dto.role,
    };
  }

  async revokeRole(user: AuthenticatedUser, dto: ManageStaffRoleDto) {
    this.ensureCanManageRole(user.roles, dto.role);

    const existing = await this.db.query.staffRoles.findFirst({
      where: and(
        eq(staffRoles.userId, dto.userId),
        eq(staffRoles.role, dto.role)
      ),
    });

    if (!existing) {
      throw new NotFoundException("That staff role is not currently assigned.");
    }

    if (dto.role === UserRole.OWNER) {
      const [ownerCount] = await this.db
        .select({ count: count() })
        .from(staffRoles)
        .where(eq(staffRoles.role, UserRole.OWNER));

      if ((ownerCount?.count ?? 0) <= 1) {
        throw new ForbiddenException(
          "BookShare must keep at least one persisted owner role."
        );
      }
    }

    await this.db
      .delete(staffRoles)
      .where(
        and(eq(staffRoles.userId, dto.userId), eq(staffRoles.role, dto.role))
      );

    return {
      ok: true,
      userId: dto.userId,
      role: dto.role,
    };
  }

  private ensureCanManageRole(actorRoles: string[], targetRole: string) {
    if (actorRoles.includes(UserRole.OWNER)) {
      return;
    }

    if (
      actorRoles.includes(UserRole.MANAGER) &&
      [UserRole.STAFF, UserRole.VIEWER].includes(targetRole as any)
    ) {
      return;
    }

    throw new ForbiddenException("You do not have permission to manage that role.");
  }

  private getKratosAdminUrl() {
    return this.configService.get<string>("KRATOS_ADMIN_URL") || "http://kratos:4434";
  }

  private normalizeText(value: unknown) {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeEmail(value: unknown) {
    const normalized = this.normalizeText(value);
    return normalized ? normalized.toLowerCase() : null;
  }

  private normalizeQuery(value: string | undefined) {
    return value?.trim().toLowerCase() ?? "";
  }

  private parseBootstrapEmails() {
    return new Set(
      (this.configService.get<string>("BOOTSTRAP_ADMIN_EMAILS") ?? "")
        .split(",")
        .map((value) => this.normalizeEmail(value))
        .filter((value): value is string => !!value)
    );
  }

  private async loadRoleMap() {
    const persisted = await this.db
      .select({
        userId: staffRoles.userId,
        role: staffRoles.role,
      })
      .from(staffRoles);

    const roleMap = new Map<string, string[]>();

    for (const entry of persisted) {
      const roles = roleMap.get(entry.userId) ?? [];
      roles.push(entry.role);
      roleMap.set(entry.userId, roles);
    }

    return roleMap;
  }

  private buildDisplayName(
    firstName: string | null,
    lastName: string | null,
    email: string | null,
    userId: string
  ) {
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    return fullName || email || userId;
  }

  private toIdentity(record: KratosIdentityRecord): StaffIdentity {
    const email = this.normalizeEmail(record.traits?.email);
    const firstName = this.normalizeText(record.traits?.name?.first);
    const lastName = this.normalizeText(record.traits?.name?.last);

    return {
      userId: record.id,
      email,
      firstName,
      lastName,
      displayName: this.buildDisplayName(firstName, lastName, email, record.id),
      emailVerified:
        record.verifiable_addresses?.some((entry) => {
          const value = this.normalizeEmail(entry.value);
          return value === email && entry.verified === true;
        }) ?? false,
      state: this.normalizeText(record.state),
    };
  }

  private fallbackIdentity(userId: string): StaffIdentity {
    return {
      userId,
      email: null,
      firstName: null,
      lastName: null,
      displayName: userId,
      emailVerified: false,
      state: null,
    };
  }

  private matchesIdentityQuery(
    identity: Pick<StaffIdentity, "userId" | "email" | "displayName"> & {
      roles?: Array<{ role: string }>;
    },
    query: string
  ) {
    if (!query) return true;

    const haystacks = [
      identity.userId.toLowerCase(),
      identity.email?.toLowerCase() ?? "",
      identity.displayName.toLowerCase(),
      ...(identity.roles?.map((role) => role.role.toLowerCase()) ?? []),
    ];

    return haystacks.some((value) => value.includes(query));
  }

  private compareIdentitySearchResults(left: string, right: string) {
    return left.localeCompare(right, undefined, { sensitivity: "base" });
  }

  private async fetchIdentities() {
    const url = new URL("/admin/identities", this.getKratosAdminUrl());
    url.searchParams.set("page_size", "100");

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        return [];
      }

      const payload = (await response.json()) as KratosIdentityRecord[];
      return payload.map((record) => this.toIdentity(record));
    } catch {
      return [];
    }
  }

  private async fetchIdentity(userId: string) {
    const url = new URL(
      `/admin/identities/${encodeURIComponent(userId)}`,
      this.getKratosAdminUrl()
    );

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

      const payload = (await response.json()) as KratosIdentityRecord;
      return this.toIdentity(payload);
    } catch {
      return null;
    }
  }
}
