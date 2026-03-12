# Workflows

This app contains BookShare background workflows powered by Motia.

Motia's documentation uses `src/` as the home for workflow logic, and this
package now follows that layout.

## Dev URLs

- Engine API: `http://localhost:3335`
- iii console: `http://localhost:3113`

## Structure

Code is grouped by business flow, not by trigger type.

- `src/steps/<flow>/` contains Motia step entrypoints only.
- `src/lib/<flow>/` contains helper code used by those steps.
- `src/config/flows.ts` centralizes flow names used by step configs.
- `src/config/topics.ts` centralizes topic names used by triggers and enqueues.

Current layout:

```text
apps/workflows/
  src/
    config/
      flows.ts
      topics.ts
    lib/
      matching/
        notifications.ts
    steps/
      audit/
        copy-status-change.step.ts
      catalog/
        isbn-lookup.step.ts
      ingress/
        workflow-events.step.ts
      maintenance/
        stale-listings.step.ts
      matching/
        copy-wish-matcher.step.ts
        wish-copy-matcher.step.ts
```

## Flows

### `ingress`

Purpose: accept external domain events and enqueue them into Motia.

- [`workflow-events.step.ts`](/Users/mac/Desktop/Projects/library/apps/workflows/src/steps/ingress/workflow-events.step.ts)
  - Trigger: `POST /events`
  - Role: validates supported workflow event envelopes and enqueues them to the matching topics.

### `matching`

Purpose: connect wishes and available copies, then create in-app notifications.

- [`copy-wish-matcher.step.ts`](/Users/mac/Desktop/Projects/library/apps/workflows/src/steps/matching/copy-wish-matcher.step.ts)
  - Trigger: `copy.created`, `copy.status_changed`
  - Role: when a copy is available, notify matching wishers.

- [`wish-copy-matcher.step.ts`](/Users/mac/Desktop/Projects/library/apps/workflows/src/steps/matching/wish-copy-matcher.step.ts)
  - Trigger: `wish.created`
  - Role: notify the wisher about available copies and notify matching listers that someone is looking for the book.

- [`notifications.ts`](/Users/mac/Desktop/Projects/library/apps/workflows/src/lib/matching/notifications.ts)
  - Role: shared matching queries, notification text construction, and notification inserts.

### `catalog`

Purpose: enrich catalog data after creation.

- [`isbn-lookup.step.ts`](/Users/mac/Desktop/Projects/library/apps/workflows/src/steps/catalog/isbn-lookup.step.ts)
  - Trigger: `edition.created`
  - Role: fetch metadata from OpenLibrary and emit `edition.enriched`.

### `maintenance`

Purpose: periodic background checks that keep the platform data healthy.

- [`stale-listings.step.ts`](/Users/mac/Desktop/Projects/library/apps/workflows/src/steps/maintenance/stale-listings.step.ts)
  - Trigger: weekly cron
  - Role: find stale copies and wishes and emit a summary report.

### `audit`

Purpose: trace workflow-visible domain activity for debugging and observability.

- [`copy-status-change.step.ts`](/Users/mac/Desktop/Projects/library/apps/workflows/src/steps/audit/copy-status-change.step.ts)
  - Trigger: `copy.status_changed`
  - Role: log status change payloads received by Motia.

## Conventions

- Add `config.flows` to every new step so the flow is visible in the code and in Motia metadata.
- Keep helper files out of `src/steps/` so Motia does not try to load them as steps.
- If a flow grows, add more helper files under `src/lib/<flow>/` before adding cross-flow shared code.
- Group new steps by domain responsibility:
  - matching and notifications go under `matching/`
  - enrichment goes under `catalog/`
  - scheduled cleanups and reminders go under `maintenance/`
  - event logging or debugging hooks go under `audit/`
  - external HTTP entrypoints go under `ingress/`

## Flows vs Topics

`flows` are organizational labels. They help group steps in code and in Motia
visualization, but they do not isolate execution.

Runtime execution is driven by triggers:

- queue topics
- HTTP routes
- cron schedules
- state triggers
- stream triggers

That means a step in one flow can enqueue a topic that triggers a step in a
different flow. The flow boundary does not block that.

Example:

- a step in `matching` can enqueue `copy.status_changed`
- a step in `audit` can subscribe to `copy.status_changed`
- both will work normally because the topic, not the flow, controls dispatch

Use this rule of thumb:

- `topics` decide what runs
- `flows` decide how the code is grouped and how humans read it
