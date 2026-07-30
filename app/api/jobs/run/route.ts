import { serve } from "inngest/next";
import { inngest } from "@/lib/jobs/client";
import { noopJob } from "@/lib/jobs/noop";
import { importStoreProductsJob } from "@/lib/jobs/import";

// The endpoint Inngest's infrastructure (Cloud or the local Dev Server)
// calls to introspect and execute registered functions, per
// context/architecture.md's app/api/jobs/run/ entry ("the endpoint the job
// scheduler ... hits"). With Inngest, "enqueuing" a job is inngest.send()
// from a server action (Units 15/17), not a caller polling this route
// directly — this route is what Inngest itself calls back into.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [noopJob, importStoreProductsJob],
});
