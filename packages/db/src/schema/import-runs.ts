import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const importRunStatusEnum = pgEnum("import_run_status", [
  "invalid",
  "validated",
  "committed",
]);

export const importEntityTypeEnum = pgEnum("import_entity_type", [
  "books",
  "editions",
  "copies",
  "wants",
]);

// High-level record for each importer execution.
export const importRuns = pgTable("import_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUsername: varchar("actor_username", { length: 255 }).notNull(),
  sourceZipName: varchar("source_zip_name", { length: 1000 }).notNull(),
  sourceZipSha256: varchar("source_zip_sha256", { length: 64 }).notNull(),
  status: importRunStatusEnum("status").notNull().default("invalid"),
  rowCount: integer("row_count").notNull().default(0),
  issueCount: integer("issue_count").notNull().default(0),
  summary: jsonb("summary").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  committedAt: timestamp("committed_at", { withTimezone: true }),
});

// Normalized raw rows accepted during validation for a run.
export const importRunPayloads = pgTable(
  "import_run_payloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => importRuns.id, { onDelete: "cascade" }),
    entityType: importEntityTypeEnum("entity_type").notNull(),
    rowNumber: integer("row_number").notNull(),
    sourceRef: varchar("source_ref", { length: 255 }).notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("import_run_payloads_run_entity_source_ref_unique").on(
      t.runId,
      t.entityType,
      t.sourceRef
    ),
  ]
);

// Mapping from source references to committed entity IDs.
export const importEntityRefs = pgTable(
  "import_entity_refs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => importRuns.id, { onDelete: "restrict" }),
    entityType: importEntityTypeEnum("entity_type").notNull(),
    sourceRef: varchar("source_ref", { length: 255 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("import_entity_refs_entity_source_ref_unique").on(
      t.entityType,
      t.sourceRef
    ),
  ]
);

// Relation graph for importer tables.
export const importRunsRelations = relations(importRuns, ({ many }) => ({
  payloads: many(importRunPayloads),
  entityRefs: many(importEntityRefs),
}));

export const importRunPayloadsRelations = relations(
  importRunPayloads,
  ({ one }) => ({
    run: one(importRuns, {
      fields: [importRunPayloads.runId],
      references: [importRuns.id],
    }),
  })
);

export const importEntityRefsRelations = relations(importEntityRefs, ({ one }) => ({
  run: one(importRuns, {
    fields: [importEntityRefs.runId],
    references: [importRuns.id],
  }),
}));
