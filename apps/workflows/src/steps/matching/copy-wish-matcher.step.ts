import {
  type CopyCreatedWorkflowEvent,
  type CopyStatusChangedWorkflowEvent,
} from "@bookshare/shared";
import { WorkflowFlows } from "../../config/flows";
import { handleCopyWishMatch } from "../../lib/matching/notifications";
import { WorkflowTopics } from "../../config/topics";

type MatcherContext = {
  logger: {
    info: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
    warn?: (message: string, meta?: Record<string, unknown>) => void;
  };
};

export const config = {
  name: "Copy Wish Matcher",
  description: "Notify wishers when a copy becomes available",
  flows: [WorkflowFlows.matching],
  triggers: [
    { type: "queue", topic: WorkflowTopics.copyCreated },
    { type: "queue", topic: WorkflowTopics.copyStatusChanged },
  ],
} as const;

export async function handler(
  input: CopyCreatedWorkflowEvent | CopyStatusChangedWorkflowEvent,
  { logger }: MatcherContext
) {
  if ("toStatus" in input && input.toStatus !== "available") {
    logger.info("Skipping copy wish matcher because status is not available", {
      copyId: input.copyId,
      toStatus: input.toStatus,
    });
    return;
  }

  await handleCopyWishMatch(input, logger);
}
