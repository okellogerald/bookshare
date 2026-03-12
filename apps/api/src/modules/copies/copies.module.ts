import { Module } from "@nestjs/common";
import { CopiesController } from "./copies.controller";
import { CopiesService } from "./copies.service";
import { WorkflowEventsModule } from "../workflow-events/workflow-events.module";

@Module({
  imports: [WorkflowEventsModule],
  controllers: [CopiesController],
  providers: [CopiesService],
  exports: [CopiesService],
})
export class CopiesModule {}
