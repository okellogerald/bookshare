import { WorkflowTopic } from "@bookshare/shared";

export const WorkflowTopics = {
  copyCreated: WorkflowTopic.COPY_CREATED,
  copyStatusChanged: WorkflowTopic.COPY_STATUS_CHANGED,
  wishCreated: WorkflowTopic.WISH_CREATED,
  editionCreated: "edition.created",
  editionEnriched: "edition.enriched",
  staleListingsReport: "stale_listings.report",
} as const;

export type WorkflowTopicName =
  (typeof WorkflowTopics)[keyof typeof WorkflowTopics];
