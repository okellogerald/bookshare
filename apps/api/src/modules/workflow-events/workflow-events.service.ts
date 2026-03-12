import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { WorkflowEventPayloadMap, WorkflowTopic } from "@bookshare/shared";

@Injectable()
export class WorkflowEventsService {
  private readonly logger = new Logger(WorkflowEventsService.name);
  private readonly workflowsUrl: string | null;

  constructor(private readonly configService: ConfigService) {
    const configuredUrl = this.configService.get<string>("WORKFLOWS_URL")?.trim();
    this.workflowsUrl = configuredUrl ? configuredUrl.replace(/\/+$/, "") : null;
  }

  async publish<TTopic extends WorkflowTopic>(
    topic: TTopic,
    data: WorkflowEventPayloadMap[TTopic]
  ) {
    if (!this.workflowsUrl) {
      this.logger.warn(
        `Skipping workflow event '${topic}' because WORKFLOWS_URL is not configured`
      );
      return false;
    }

    try {
      const response = await fetch(`${this.workflowsUrl}/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ topic, data }),
      });

      if (!response.ok) {
        const detail = await response.text();
        this.logger.error(
          `Workflow event '${topic}' failed with status ${response.status}: ${detail}`
        );
        return false;
      }

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown workflow publishing error";
      this.logger.error(`Workflow event '${topic}' failed: ${message}`);
      return false;
    }
  }
}
