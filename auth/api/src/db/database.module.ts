import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createAuthDb } from "./database";

export const AUTH_DB = "AUTH_DB";

@Module({
  providers: [
    {
      provide: AUTH_DB,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return createAuthDb(configService.getOrThrow<string>("DATABASE_URL"));
      },
    },
  ],
  exports: [AUTH_DB],
})
export class DatabaseModule {}
