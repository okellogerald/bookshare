import { Module } from "@nestjs/common";
import { MailerModule } from "../mailer/mailer.module";
import { SubmissionsController } from "./submissions.controller";
import { SubmissionsService } from "./submissions.service";

@Module({
  imports: [MailerModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
