import type { WorkflowEventEnvelope } from "@bookshare/shared";
import { getWorkflowsUrl } from "./env";

function reportWorkflowFailure(topic: string, detail: string) {
  console.error(`[import:commit] workflow event failed | topic=${topic} ${detail}`);
}

export async function publishWorkflowEvents(events: WorkflowEventEnvelope[]) {
  if (events.length === 0) {
    return { attempted: 0, delivered: 0 };
  }

  const workflowsUrl = getWorkflowsUrl();
  if (!workflowsUrl) {
    return { attempted: events.length, delivered: 0 };
  }

  let delivered = 0;
  for (const event of events) {
    try {
      const response = await fetch(`${workflowsUrl}/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const detail = await response.text();
        reportWorkflowFailure(event.topic, `status=${response.status} detail=${detail}`);
        continue;
      }

      delivered += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown workflow publishing error";
      reportWorkflowFailure(event.topic, `error=${message}`);
    }
  }

  return {
    attempted: events.length,
    delivered,
  };
}
