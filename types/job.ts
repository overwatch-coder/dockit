export type JobType = "PUSH" | "SYNC" | "DELETE";

export type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "PARTIAL";

export type Job = {
  id: string;
  storeId: string;
  type: JobType;
  status: JobStatus;
  results: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
};

// Unit 16: the shape of Job.results for a batch push (lib/jobs/push.ts's
// pushBatchJob writes this, components/product-table.tsx's "Push selected"
// action reads it back after polling) — kept as a shared type so neither
// side duplicates an inline cast of the opaque Job.results Json column.
export type PushBatchResultItem =
  | { productId: string; success: true; shopifyProductId: string }
  | { productId: string; success: false; failedStep: string; error: string };

export type PushBatchResults = { items: PushBatchResultItem[] };

// Unit 17/18: the shape of Job.results for a successful "Sync Store" run
// (lib/jobs/import.ts's syncStoreJob writes this, components/sync-store-button.tsx
// reads it back after polling). skippedCount was renamed conflictedCount in
// Unit 18: what used to be a silent no-op skip is now a flagged conflict
// (Product.isConflicted + snapshots) that the owner needs to know about and
// resolve (Unit 19), not just a count of nothing-happened.
export type SyncStoreResults = { syncedCount: number; conflictedCount: number; errorCount: number };
