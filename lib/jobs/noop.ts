import { inngest } from "@/lib/jobs/client";
import { createJob, updateJobStatus } from "@/lib/db/jobs";

// Unit 6 scope: prove the job queue plumbing (Inngest fires -> job runs ->
// status recorded in Postgres) works end to end. No real Shopify work here —
// that's Units 15 (push) and 17 (sync). Uses JobType "SYNC" rather than
// inventing a new enum value for this test, since the schema's JobType is
// deliberately just PUSH | SYNC (context/00-build-plan.md Unit 2/6).
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
