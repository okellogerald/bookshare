import { Module } from "@nestjs/common";
import { PostgrestProxyController } from "./postgrest-proxy.controller";
import { PostgrestProxyService } from "./postgrest-proxy.service";

@Module({
  controllers: [PostgrestProxyController],
  providers: [PostgrestProxyService],
  exports: [PostgrestProxyService],
})
export class PostgrestProxyModule {}
