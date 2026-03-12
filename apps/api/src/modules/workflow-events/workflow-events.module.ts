import { Module } from "@nestjs/common";
import { WorkflowEventsService } from "./workflow-events.service";

@Module({
  providers: [WorkflowEventsService],
  exports: [WorkflowEventsService],
})
export class WorkflowEventsModule {}
