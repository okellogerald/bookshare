import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DrizzleService, DRIZZLE } from "./drizzle.service";

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: (configService: ConfigService) => {
        const url = configService.getOrThrow<string>("DATABASE_URL");
        return DrizzleService.create(url);
      },
      inject: [ConfigService],
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
