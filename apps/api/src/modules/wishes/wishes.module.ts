import { Module } from "@nestjs/common";
import { WishesController } from "./wishes.controller";
import { WishesService } from "./wishes.service";
import { WorkflowEventsModule } from "../workflow-events/workflow-events.module";

@Module({
  imports: [WorkflowEventsModule],
  controllers: [WishesController],
  providers: [WishesService],
  exports: [WishesService],
})
export class WishesModule {}
