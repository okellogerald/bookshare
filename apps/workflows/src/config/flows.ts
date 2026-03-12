export const WorkflowFlows = {
  ingress: "ingress",
  matching: "matching",
  catalog: "catalog",
  maintenance: "maintenance",
  audit: "audit",
} as const;

export type WorkflowFlowName =
  (typeof WorkflowFlows)[keyof typeof WorkflowFlows];
