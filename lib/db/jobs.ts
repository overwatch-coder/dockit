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

// Unit 15: scoped by accountId, mirrors getProductById's null-on-not-found
// pattern — used by the push button's polling server action.
export async function getJobById(accountId: string, jobId: string): Promise<Job | null> {
  const job = await prisma.job.findFirst({ where: { id: jobId, accountId } });
  return job ? toDomainJob(job) : null;
}

// Unit 20: backs the persistent job status indicator — the single most
// recent job for a store, regardless of its status, so the indicator can
// tell "currently running" (PENDING/RUNNING) apart from "just finished, and
// the owner might not have seen it" (PARTIAL/FAILED) from "nothing to show"
// (SUCCEEDED, or no job ever run). storeId-scoped the same way every other
// job query in this file already is; `getStoresForAccount(...)[0]` ("first
// connected store") resolves storeId at the call site, same convention as
// pushAllDrafts/syncStore (app/(dashboard)/products/actions.ts) pending
// Unit 21's real store switcher.
export async function getLatestJobForStore(accountId: string, storeId: string): Promise<Job | null> {
  const job = await prisma.job.findFirst({
    where: { accountId, storeId },
    orderBy: { createdAt: "desc" },
  });
  return job ? toDomainJob(job) : null;
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
