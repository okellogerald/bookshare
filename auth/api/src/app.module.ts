import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { createPinoHttpLoggerOptions } from "@bookshare/logger";
import { AuthGuard, RolesGuard } from "./common/auth";
import { DatabaseModule } from "./db/database.module";
import { HealthModule } from "./modules/health/health.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: createPinoHttpLoggerOptions("auth-api"),
    }),
    DatabaseModule,
    HealthModule,
    OrganizationsModule,
  ],
  providers: [AuthGuard, RolesGuard],
})
export class AppModule {}
