import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthGuard, RolesGuard } from "./common/auth";
import { DatabaseModule } from "./db/database.module";
import { HealthModule } from "./modules/health/health.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    HealthModule,
    OrganizationsModule,
  ],
  providers: [AuthGuard, RolesGuard],
})
export class AppModule {}
