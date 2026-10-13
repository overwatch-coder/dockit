export type JobType = "PUSH" | "SYNC" | "DELETE" | "GENERATE_IMAGE";

export type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "PARTIAL";

export type ImageGenerationJobResult =
  | {
      productId: string;
      success: true;
      generatedUrls: string[];
      count: number;
    }
  | {
      productId: string;
      success: false;
      error: string;
    };

export type Job = {
  id: string;
  storeId: string;
  type: JobType;
  status: JobStatus;
  results: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  // The job status indicator orders by/displays this ("started Xm ago").
  createdAt: Date;
};

// The shape of Job.results for a batch push (lib/jobs/push.ts's
// pushBatchJob writes this, components/product-table.tsx's "Push selected"
// action reads it back after polling) — kept as a shared type so neither
// side duplicates an inline cast of the opaque Job.results Json column.
export type PushBatchResultItem =
  | { productId: string; success: true; shopifyProductId: string }
  | { productId: string; success: false; failedStep: string; error: string };

export type PushBatchResults = { items: PushBatchResultItem[] };

// The shape of Job.results for a successful "Sync Store" run
// (lib/jobs/import.ts's syncStoreJob writes this, components/sync-store-button.tsx
// reads it back after polling). Conflicted products are flagged for review
// (Product.isConflicted + snapshots) rather than silently skipped.
export type SyncStoreResults = { syncedCount: number; conflictedCount: number; errorCount: number };
