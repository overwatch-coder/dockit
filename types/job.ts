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
