/**
 * Copy Status Change Step
 *
 * Logs copy status changes flowing through the workflow engine.
 *
 * Trigger: copy.status_changed event
 */

import { type CopyStatusChangedWorkflowEvent } from "@bookshare/shared";
import { WorkflowFlows } from "../../config/flows";
import { WorkflowTopics } from "../../config/topics";

export const config = {
  name: "Copy Status Change Logger",
  description: "Log copy status change events received by workflows",
  flows: [WorkflowFlows.audit],
  triggers: [{ type: "queue", topic: WorkflowTopics.copyStatusChanged }],
} as const;

type LoggerContext = {
  logger: {
    info: (message: string, meta?: Record<string, unknown>) => void;
  };
};

export async function handler(input: CopyStatusChangedWorkflowEvent, { logger }: LoggerContext) {
  logger.info("Received copy status change event", {
    copyId: input.copyId,
    userId: input.userId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
  });
}
