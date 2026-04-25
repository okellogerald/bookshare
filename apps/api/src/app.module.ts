import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { createPinoHttpLoggerOptions } from "@bookshare/logger";
import { DrizzleModule } from "./drizzle/drizzle.module";
import { AuthorizationModule } from "./common/authorization/authorization.module";
import { AuthGuard } from "./common/guards/auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { BooksModule } from "./modules/books/books.module";
import { AuthorsModule } from "./modules/authors/authors.module";
import { EditionsModule } from "./modules/editions/editions.module";
import { QuotesModule } from "./modules/quotes/quotes.module";
import { CopiesModule } from "./modules/copies/copies.module";
import { EventsModule } from "./modules/events/events.module";
import { UploadModule } from "./modules/upload/upload.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CollectionsModule } from "./modules/collections/collections.module";
import { WishesModule } from "./modules/wishes/wishes.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { SubmissionsModule } from "./modules/submissions/submissions.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { StaffModule } from "./modules/staff/staff.module";
import { ImportsModule } from "./modules/imports/imports.module";
import { ReadGatewayModule } from "./modules/read-gateway/read-gateway.module";
import { BookstoresModule } from "./modules/bookstores/bookstores.module";
import { RequestsModule } from "./modules/requests/requests.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: createPinoHttpLoggerOptions("bookshare-api"),
    }),
    DrizzleModule,
    AuthorizationModule,
    BooksModule,
    AuthorsModule,
    EditionsModule,
    QuotesModule,
    CopiesModule,
    EventsModule,
    UploadModule,
    CategoriesModule,
    CollectionsModule,
    WishesModule,
    NotificationsModule,
    ProfilesModule,
    SubmissionsModule,
    StaffModule,
    ImportsModule,
    ReadGatewayModule,
    BookstoresModule,
    RequestsModule,
  ],
  providers: [
    AuthGuard,
    RolesGuard,
    PermissionsGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_GUARD, useExisting: PermissionsGuard },
  ],
})
export class AppModule {}
