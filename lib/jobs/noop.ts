import { inngest } from "@/lib/jobs/client";
import { createJob, updateJobStatus } from "@/lib/db/jobs";

// Proves the job queue plumbing (Inngest fires -> job runs -> status recorded in
// Postgres) end to end without executing real Shopify API mutations.
export const noopJob = inngest.createFunction(
  { id: "noop-job", triggers: { event: "jobs/noop.triggered" } },
  async ({ event, step }) => {
    const { accountId, storeId } = event.data as { accountId: string; storeId: string };

    const job = await step.run("create-job", () => createJob({ accountId, storeId, type: "SYNC" }));

    await step.run("mark-running", () =>
      updateJobStatus({ accountId, jobId: job.id, status: "RUNNING" })
    );

    await step.run("mark-succeeded", () =>
      updateJobStatus({
        accountId,
        jobId: job.id,
        status: "SUCCEEDED",
        results: { noop: true },
      })
    );

    return { jobId: job.id };
  }
);
