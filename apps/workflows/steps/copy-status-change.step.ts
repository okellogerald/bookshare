/**
 * Copy Status Change Step
 *
 * When a copy's status changes, automatically creates a CopyEvent
 * record in the database for audit trail purposes.
 *
 * Trigger: copy.status_changed event
 * Output: copy_event.created event
 */

export const config = {
  name: "Copy Status Change Logger",
  description: "Auto-create CopyEvent when a copy status changes",
  triggers: [{ type: "queue", topic: "copy.status_changed" }],
  enqueues: ["copy_event.created"],
} as const;

interface StatusChangeInput {
  copyId: string;
  userId: string;
  fromStatus: string;
  toStatus: string;
  performedBy: string;
  eventType: string;
  amount?: string;
  currency?: string;
  notes?: string;
}

export async function handler(input: StatusChangeInput, { enqueue, logger }: any) {
  const {
    copyId,
    userId,
    fromStatus,
    toStatus,
    performedBy,
    eventType,
    amount,
    currency,
    notes,
  } = input;

  logger.info(
    `Copy ${copyId}: ${fromStatus} → ${toStatus} (${eventType}) by ${performedBy}`
  );

  await enqueue({
    topic: "copy_event.created",
    data: {
      copyId,
      userId,
      eventType,
      fromStatus,
      toStatus,
      performedBy,
      amount: amount ?? null,
      currency: currency ?? null,
      notes: notes ?? null,
      metadata: null,
    },
  });
}
