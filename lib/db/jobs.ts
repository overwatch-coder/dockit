import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Job, JobStatus, JobType } from "@/types/job";

type JobRecord = {
  id: string;
  storeId: string;
  type: JobType;
  status: JobStatus;
  results: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

function toDomainJob(job: JobRecord): Job {
  return {
    id: job.id,
    storeId: job.storeId,
    type: job.type,
    status: job.status,
    results: job.results,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
  };
}

export async function createJob(input: {
  accountId: string;
  storeId: string;
  type: JobType;
}): Promise<Job> {
  const job = await prisma.job.create({
    data: {
      accountId: input.accountId,
      storeId: input.storeId,
      type: input.type,
    },
  });
  return toDomainJob(job);
}

// Scoped by accountId, mirrors getProductById's null-on-not-found
// pattern — used by the push and background job polling server actions.
export async function getJobById(accountId: string, jobId: string): Promise<Job | null> {
  const job = await prisma.job.findFirst({ where: { id: jobId, accountId } });
  return job ? toDomainJob(job) : null;
}

// Backs the persistent job status indicator — returns the single most
// recent job for a store. If the latest job is PENDING or RUNNING but has
// exceeded its stale timeout threshold, auto-expire it to FAILED so the
// UI never gets stuck showing in-progress status indefinitely.
export async function getLatestJobForStore(accountId: string, storeId: string): Promise<Job | null> {
  const job = await prisma.job.findFirst({
    where: { accountId, storeId },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return null;

  // AI image generation can take 1-3 minutes for multi-image batches, so allow 5 minutes (300s)
  // before considering stale. Push and sync jobs keep standard 90s.
  const timeoutMs = job.type === "GENERATE_IMAGE" ? 300_000 : 90_000;

  const isStale =
    (job.status === "PENDING" || job.status === "RUNNING") &&
    Date.now() - new Date(job.createdAt).getTime() > timeoutMs;

  if (isStale) {
    const errorMsg =
      job.type === "SYNC"
        ? "Sync timed out. Shopify connection did not respond."
        : `${job.type.toLowerCase()} job timed out.`;
    const now = new Date();
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        results: { error: errorMsg },
        completedAt: now,
      },
    });
    return toDomainJob({
      ...job,
      status: "FAILED",
      results: { error: errorMsg },
      completedAt: now,
    });
  }

  return toDomainJob(job);
}

export async function updateJobProgress(input: {
  accountId: string;
  jobId: string;
  progress: number;
  stage: string;
  current?: number;
  total?: number;
}): Promise<void> {
  await prisma.job.updateMany({
    where: { id: input.jobId, accountId: input.accountId },
    data: {
      status: "RUNNING",
      results: {
        progress: input.progress,
        stage: input.stage,
        current: input.current,
        total: input.total,
      },
    },
  });
}

export async function updateJobStatus(input: {
  accountId: string;
  jobId: string;
  status: JobStatus;
  results?: Prisma.InputJsonValue;
}): Promise<{ updated: boolean }> {
  const now = new Date();
  const result = await prisma.job.updateMany({
    where: { id: input.jobId, accountId: input.accountId },
    data: {
      status: input.status,
      results: input.results,
      startedAt: input.status === "RUNNING" ? now : undefined,
      completedAt:
        input.status === "SUCCEEDED" || input.status === "FAILED" || input.status === "PARTIAL"
          ? now
          : undefined,
    },
  });
  return { updated: result.count > 0 };
}
