import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string | null;
  private readonly submissionsTo: string | null;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>("SMTP_HOST");
    const port = this.configService.get<string>("SMTP_PORT");
    const secure = this.configService.get<string>("SMTP_SECURE") === "true";
    const user = this.configService.get<string>("SMTP_USER");
    const pass = this.configService.get<string>("SMTP_PASS");
    const from = this.configService.get<string>("SMTP_FROM");
    const submissionsTo = this.configService.get<string>("SUBMISSIONS_EMAIL_TO");

    if (
      !host?.trim() ||
      !port?.trim() ||
      !from?.trim() ||
      !submissionsTo?.trim()
    ) {
      this.transporter = null;
      this.from = null;
      this.submissionsTo = null;
      return;
    }

    const trimmedUser = user?.trim();
    const trimmedPass = pass?.trim();
    const auth =
      trimmedUser && trimmedPass
        ? { user: trimmedUser, pass: trimmedPass }
        : undefined;

    this.from = from.trim();
    this.submissionsTo = submissionsTo.trim();
    this.transporter = nodemailer.createTransport({
      host: host.trim(),
      port: parseInt(port, 10),
      secure,
      auth,
    });
  }

  async sendAdminSubmission(subjectTag: string, text: string) {
    if (!this.submissionsTo) {
      throw new ServiceUnavailableException(
        "SUBMISSIONS_EMAIL_TO is not configured."
      );
    }

    await this.sendEmail({
      to: this.submissionsTo,
      subject: `${subjectTag} BookShare Submission`,
      text,
    });
  }

  async sendUserConfirmation(
    userEmail: string,
    subject: string,
    text: string
  ) {
    await this.sendEmail({
      to: userEmail,
      subject,
      text,
    });
  }

  private async sendEmail(input: SendEmailInput) {
    if (!this.transporter || !this.from) {
      throw new ServiceUnavailableException(
        "SMTP configuration is missing. Set SMTP_HOST, SMTP_PORT, SMTP_FROM, and SUBMISSIONS_EMAIL_TO."
      );
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${input.to} (subject: ${input.subject})`,
        error instanceof Error ? error.stack : String(error)
      );
      throw error;
    }
  }
}
