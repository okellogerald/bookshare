import { Module } from "@nestjs/common";
import { WantsController } from "./wants.controller";
import { WantsService } from "./wants.service";

@Module({
  controllers: [WantsController],
  providers: [WantsService],
  exports: [WantsService],
})
export class WantsModule {}
