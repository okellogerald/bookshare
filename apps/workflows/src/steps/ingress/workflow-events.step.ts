import {
  type CopyCreatedWorkflowEvent,
  type CopyStatusChangedWorkflowEvent,
  type WishCreatedWorkflowEvent,
  type WorkflowEventEnvelope,
  type WorkflowEventPayloadMap,
} from "@bookshare/shared";
import { WorkflowFlows } from "../../config/flows";
import { WorkflowTopics } from "../../config/topics";

const supportedWorkflowTopics = [
  WorkflowTopics.copyCreated,
  WorkflowTopics.copyStatusChanged,
  WorkflowTopics.wishCreated,
] as const;

type SupportedWorkflowTopic = (typeof supportedWorkflowTopics)[number];

type WorkflowRequest = {
  body?: unknown;
};

type WorkflowContext = {
  enqueue: (job: {
    topic: SupportedWorkflowTopic;
    data: WorkflowEventPayloadMap[SupportedWorkflowTopic];
  }) => Promise<void>;
  logger: {
    info: (message: string, meta?: Record<string, unknown>) => void;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCopyCreatedEvent(data: unknown): data is CopyCreatedWorkflowEvent {
  return (
    isRecord(data) &&
    typeof data.copyId === "string" &&
    typeof data.userId === "string"
  );
}

function isCopyStatusChangedEvent(data: unknown): data is CopyStatusChangedWorkflowEvent {
  return (
    isRecord(data) &&
    typeof data.copyId === "string" &&
    typeof data.userId === "string" &&
    typeof data.fromStatus === "string" &&
    typeof data.toStatus === "string"
  );
}

function isWishCreatedEvent(data: unknown): data is WishCreatedWorkflowEvent {
  return (
    isRecord(data) &&
    typeof data.wishId === "string" &&
    typeof data.userId === "string"
  );
}

function isSupportedWorkflowTopic(topic: unknown): topic is SupportedWorkflowTopic {
  return (
    typeof topic === "string" &&
    (supportedWorkflowTopics as readonly string[]).includes(topic)
  );
}

function isWorkflowEventEnvelope(body: unknown): body is WorkflowEventEnvelope<SupportedWorkflowTopic> {
  if (!isRecord(body) || !isSupportedWorkflowTopic(body.topic)) {
    return false;
  }

  if (body.topic === WorkflowTopics.copyCreated) {
    return isCopyCreatedEvent(body.data);
  }

  if (body.topic === WorkflowTopics.copyStatusChanged) {
    return isCopyStatusChangedEvent(body.data);
  }

  return isWishCreatedEvent(body.data);
}

export const config = {
  name: "Workflow Event Ingress",
  description: "Accept external domain events and enqueue them for Motia steps",
  flows: [WorkflowFlows.ingress],
  triggers: [{ type: "http", method: "POST", path: "/events" }],
  enqueues: [...supportedWorkflowTopics],
} as const;

export async function handler(req: WorkflowRequest, { enqueue, logger }: WorkflowContext) {
  if (!isWorkflowEventEnvelope(req.body)) {
    return {
      status: 400,
      body: {
        error: "Invalid workflow event payload",
      },
    };
  }

  await enqueue({
    topic: req.body.topic,
    data: req.body.data,
  });

  logger.info("Accepted workflow event", {
    topic: req.body.topic,
  });

  return {
    status: 202,
    body: {
      accepted: true,
    },
  };
}
