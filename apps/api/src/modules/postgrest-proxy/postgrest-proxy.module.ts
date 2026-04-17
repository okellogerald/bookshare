import { Module } from "@nestjs/common";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PostgrestProxyMiddleware } from "./postgrest-proxy.middleware";
import { PostgrestProxyService } from "./postgrest-proxy.service";

@Module({
  providers: [PostgrestProxyService, PostgrestProxyMiddleware, AuthGuard],
  exports: [PostgrestProxyService, PostgrestProxyMiddleware],
})
export class PostgrestProxyModule {}
