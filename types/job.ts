export type JobType = "PUSH" | "SYNC";

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
