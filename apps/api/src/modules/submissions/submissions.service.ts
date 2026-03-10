import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "../../common/guards";
import { MailerService } from "../mailer/mailer.service";
import {
  CreateCopySubmissionDto,
  CreateMissingWantSubmissionDto,
} from "./dto";

interface SubmissionResponse {
  submitted: true;
}

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService
  ) {}

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
    const adminBody = this.buildCopyAdminEmailBody(dto, user.id, userEmail);

    await this.mailerService.sendAdminSubmission("[COPY SUBMISSION]", adminBody);
    await this.mailerService.sendUserConfirmation(
      userEmail,
      "BookShare copy submission received",
      [
        "Your copy submission was received and sent to the BookShare admin inbox.",
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

  private buildCopyAdminEmailBody(
    dto: CreateCopySubmissionDto,
    userId: string,
    userEmail: string
  ) {
    const lines = [
      "New copy submission received.",
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
      "Copy Details",
      `Condition: ${dto.condition || "-"}`,
      `Share Type: ${dto.shareType || "-"}`,
      `Notes: ${dto.notes?.trim() || "-"}`,
      "",
      "Copy Images",
    ];

    if (!dto.imageUrls?.length) {
      lines.push("None");
    } else {
      dto.imageUrls.forEach((url, index) => {
        lines.push(`${index + 1}. ${url}`);
      });
    }

    return lines.join("\n");
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
