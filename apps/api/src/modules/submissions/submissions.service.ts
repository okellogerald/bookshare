import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq, desc } from "drizzle-orm";
import {
  type Database,
  copySubmissions,
  copies,
  editions,
} from "@bookshare/db";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import type { AuthenticatedUser } from "../../common/guards";
import { MailerService } from "../mailer/mailer.service";
import {
  ApproveCopySubmissionDto,
  CreateCopySubmissionDto,
  CreateMissingWantSubmissionDto,
  RejectCopySubmissionDto,
} from "./dto";

interface SubmissionResponse {
  submitted: true;
}

@Injectable()
export class SubmissionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService
  ) {}

  // ── Member-facing ──────────────────────────────────────────

  async submitCopy(
    dto: CreateCopySubmissionDto,
    user: AuthenticatedUser,
    authorization: string | undefined,
    identityAccessToken: string | undefined
  ): Promise<SubmissionResponse> {
    const userEmail = await this.resolveUserEmail(
      user,
      authorization,
      identityAccessToken
    );

    // Persist to database.
    await this.db.insert(copySubmissions).values({
      userId: user.id,
      userEmail,
      title: dto.title,
      subtitle: undefined,
      authors: dto.authors,
      isbn: dto.isbn?.trim() || undefined,
      language: dto.language?.trim() || undefined,
      bookDescriptionNotes: dto.bookDescriptionNotes?.trim() || undefined,
      condition: dto.condition as typeof copySubmissions.$inferInsert.condition,
      shareType: dto.shareType as typeof copySubmissions.$inferInsert.shareType,
      notes: dto.notes?.trim() || undefined,
      contactNote: dto.contactNote?.trim() || undefined,
    });

    // Send confirmation email to user.
    await this.mailerService.sendUserConfirmation(
      userEmail,
      "BookShare copy submission received",
      [
        "Your copy submission was received and is now in the review queue.",
        "",
        `Submitted at: ${new Date().toISOString()}`,
        `Book title: ${dto.title}`,
        `Authors: ${dto.authors.join(", ")}`,
      ].join("\n")
    );

    return { submitted: true };
  }

  async submitMissingWant(
    dto: CreateMissingWantSubmissionDto,
    user: AuthenticatedUser,
    authorization: string | undefined,
    identityAccessToken: string | undefined
  ): Promise<SubmissionResponse> {
    const userEmail = await this.resolveUserEmail(
      user,
      authorization,
      identityAccessToken
    );
    const adminBody = this.buildMissingWantAdminEmailBody(dto, user.id, userEmail);

    await this.mailerService.sendAdminSubmission("[WANT REQUEST]", adminBody);
    await this.mailerService.sendUserConfirmation(
      userEmail,
      "BookShare want request received",
      [
        "Your missing-book want request was received and sent to the BookShare admin inbox.",
        "",
        `Submitted at: ${new Date().toISOString()}`,
        `Book title: ${dto.title}`,
        `Authors: ${dto.authors.join(", ")}`,
      ].join("\n")
    );

    return { submitted: true };
  }

  // ── Staff-facing ───────────────────────────────────────────

  async listCopySubmissions(status?: string) {
    if (status && !["pending", "approved", "rejected"].includes(status)) {
      throw new BadRequestException(
        "Invalid status filter. Must be pending, approved, or rejected."
      );
    }

    const rows = await this.db.query.copySubmissions.findMany({
      where: status
        ? eq(
            copySubmissions.status,
            status as "pending" | "approved" | "rejected"
          )
        : undefined,
      orderBy: [desc(copySubmissions.createdAt)],
    });

    return rows;
  }

  async getCopySubmission(id: string) {
    const row = await this.db.query.copySubmissions.findFirst({
      where: eq(copySubmissions.id, id),
    });

    if (!row) {
      throw new NotFoundException("Copy submission not found.");
    }

    return row;
  }

  async approveCopySubmission(
    id: string,
    dto: ApproveCopySubmissionDto,
    reviewerUsername: string
  ) {
    const submission = await this.db.query.copySubmissions.findFirst({
      where: eq(copySubmissions.id, id),
    });

    if (!submission) {
      throw new NotFoundException("Copy submission not found.");
    }

    if (submission.status !== "pending") {
      throw new BadRequestException(
        `Submission is already ${submission.status}.`
      );
    }

    // Verify edition exists.
    const edition = await this.db.query.editions.findFirst({
      where: eq(editions.id, dto.editionId),
    });

    if (!edition) {
      throw new BadRequestException("Edition not found.");
    }

    // Determine copy fields: use DTO overrides or fall back to submission values.
    const condition = (dto.condition ?? submission.condition ?? "good") as
      | "new"
      | "like_new"
      | "good"
      | "fair"
      | "poor";
    const shareType = (dto.shareType ?? submission.shareType ?? undefined) as
      | "lend"
      | "sell"
      | "give_away"
      | undefined;

    // Create the copy for the member.
    const [createdCopy] = await this.db
      .insert(copies)
      .values({
        userId: submission.userId,
        editionId: dto.editionId,
        condition,
        status: "available",
        shareType: shareType ?? null,
        notes: dto.notes?.trim() || submission.notes || undefined,
        contactNote:
          dto.contactNote?.trim() || submission.contactNote || undefined,
      })
      .returning({ id: copies.id });

    // Update submission status.
    await this.db
      .update(copySubmissions)
      .set({
        status: "approved",
        reviewerUsername,
        reviewedAt: new Date(),
        reviewNotes: dto.reviewNotes?.trim() || undefined,
        resolvedEditionId: dto.editionId,
        resolvedCopyId: createdCopy.id,
      })
      .where(eq(copySubmissions.id, id));

    return {
      approved: true,
      copyId: createdCopy.id,
      editionId: dto.editionId,
    };
  }

  async rejectCopySubmission(
    id: string,
    dto: RejectCopySubmissionDto,
    reviewerUsername: string
  ) {
    const submission = await this.db.query.copySubmissions.findFirst({
      where: eq(copySubmissions.id, id),
    });

    if (!submission) {
      throw new NotFoundException("Copy submission not found.");
    }

    if (submission.status !== "pending") {
      throw new BadRequestException(
        `Submission is already ${submission.status}.`
      );
    }

    await this.db
      .update(copySubmissions)
      .set({
        status: "rejected",
        reviewerUsername,
        reviewedAt: new Date(),
        reviewNotes: dto.reviewNotes?.trim() || undefined,
      })
      .where(eq(copySubmissions.id, id));

    return { rejected: true };
  }

  // ── Private helpers ────────────────────────────────────────

  private async resolveUserEmail(
    user: AuthenticatedUser,
    authorization: string | undefined,
    identityAccessToken: string | undefined
  ) {
    if (!user.email?.trim()) {
      const fallback = await this.fetchEmailFromUserInfo(
        authorization,
        identityAccessToken
      );
      if (!fallback) {
        throw new BadRequestException(
          "Could not resolve your email from identity provider. Please sign out and sign in again."
        );
      }
      return fallback;
    }
    return user.email.trim();
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

  private extractBearerToken(authorization: string | undefined) {
    if (!authorization) return null;
    const [type, token] = authorization.split(" ");
    if (type !== "Bearer" || !token) return null;
    return token;
  }

  private async fetchEmailFromUserInfo(
    authorization: string | undefined,
    identityAccessToken: string | undefined
  ) {
    const token =
      identityAccessToken?.trim() || this.extractBearerToken(authorization);
    if (!token) return null;

    const { issuer, issuerInternal, issuerHost, userInfoEndpoint } =
      this.getIdentityProviderEndpoints();

    const headers = new Headers({
      Authorization: `Bearer ${token}`,
    });

    if (issuerInternal !== issuer) {
      headers.set("host", issuerHost);
    }

    const response = await fetch(userInfoEndpoint, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new BadGatewayException(
        "Failed to resolve user email from identity provider"
      );
    }

    const payload = (await response.json()) as { email?: string };
    return payload.email?.trim() || null;
  }

  private buildMissingWantAdminEmailBody(
    dto: CreateMissingWantSubmissionDto,
    userId: string,
    userEmail: string
  ) {
    return [
      "New missing-book want request received.",
      "",
      `Submitted at: ${new Date().toISOString()}`,
      `User ID: ${userId}`,
      `User Email: ${userEmail}`,
      "",
      "Book Identifiers",
      `Title: ${dto.title}`,
      `Authors: ${dto.authors.join(", ")}`,
      `ISBN: ${dto.isbn?.trim() || "-"}`,
      `Language: ${dto.language?.trim() || "-"}`,
      `Book Description Notes: ${dto.bookDescriptionNotes?.trim() || "-"}`,
      "",
      "Want Details",
      `Want Notes: ${dto.wantNotes?.trim() || "-"}`,
    ].join("\n");
  }
}
