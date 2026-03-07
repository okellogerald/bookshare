import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { DrizzleModule } from "./drizzle/drizzle.module";
import { AuthGuard } from "./common/guards/auth.guard";
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
import { WantsModule } from "./modules/wants/wants.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { SubmissionsModule } from "./modules/submissions/submissions.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule,
    BooksModule,
    AuthorsModule,
    EditionsModule,
    QuotesModule,
    CopiesModule,
    EventsModule,
    UploadModule,
    CategoriesModule,
    CollectionsModule,
    WantsModule,
    ProfilesModule,
    SubmissionsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
