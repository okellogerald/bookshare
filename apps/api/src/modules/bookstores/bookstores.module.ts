import { Module } from "@nestjs/common";
import { BookstoresController } from "./bookstores.controller";
import { BookstoresService } from "./bookstores.service";
import { MailerModule } from "../mailer/mailer.module";

@Module({
  imports: [MailerModule],
  controllers: [BookstoresController],
  providers: [BookstoresService],
})
export class BookstoresModule {}
