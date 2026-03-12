import { type WishCreatedWorkflowEvent } from "@bookshare/shared";
import { WorkflowFlows } from "../../config/flows";
import { handleWishCopyMatch } from "../../lib/matching/notifications";
import { WorkflowTopics } from "../../config/topics";

type MatcherContext = {
  logger: {
    info: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
    warn?: (message: string, meta?: Record<string, unknown>) => void;
  };
};

export const config = {
  name: "Wish Copy Matcher",
  description: "Notify wishers and listers when a new wish matches available copies",
  flows: [WorkflowFlows.matching],
  triggers: [{ type: "queue", topic: WorkflowTopics.wishCreated }],
} as const;

export async function handler(input: WishCreatedWorkflowEvent, { logger }: MatcherContext) {
  await handleWishCopyMatch(input, logger);
}
