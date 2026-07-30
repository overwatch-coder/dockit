import { inngest } from "@/lib/jobs/client";
import { createJob, updateJobStatus } from "@/lib/db/jobs";
import { getStoreToken } from "@/lib/db/stores";
import { importProducts } from "@/lib/db/products";
import { decryptAccessToken } from "@/lib/shopify/oauth";
import { fetchAllProducts } from "@/lib/shopify/products";

// Fires once per store connection (see triggerStoreImport below), pulling
// the store's full catalog into Postgres. Uses JobType "SYNC" — the schema's
// JobType is deliberately just PUSH | SYNC (context/00-build-plan.md Unit
// 2/6), and an initial import is a pull from Shopify like Unit 17's sync,
// just for a brand-new store instead of a re-sync.
export const importStoreProductsJob = inngest.createFunction(
  { id: "import-store-products", triggers: { event: "store/connected" } },
  async ({ event, step }) => {
    const { accountId, storeId, shopifyDomain } = event.data as {
      accountId: string;
      storeId: string;
      shopifyDomain: string;
    };

    const job = await step.run("create-job", () => createJob({ accountId, storeId, type: "SYNC" }));

    await step.run("mark-running", () =>
      updateJobStatus({ accountId, jobId: job.id, status: "RUNNING" })
    );

    const result = await step.run("fetch-and-import", async () => {
      const tokenRecord = await getStoreToken(accountId, storeId);
      if (!tokenRecord) {
        return { success: false as const, error: "Store or token not found" };
      }

      const accessToken = decryptAccessToken(tokenRecord.accessTokenEncrypted);
      const fetched = await fetchAllProducts(shopifyDomain, accessToken);
      if (!fetched.success) {
        return { success: false as const, error: fetched.error };
      }

      const { importedCount } = await importProducts({ accountId, storeId, products: fetched.data });
      return { success: true as const, importedCount };
    });

    if (result.success) {
      await step.run("mark-succeeded", () =>
        updateJobStatus({
          accountId,
          jobId: job.id,
          status: "SUCCEEDED",
          results: { importedCount: result.importedCount },
        })
      );
    } else {
      console.error(`importStoreProductsJob failed for account ${accountId}, store ${storeId}: ${result.error}`);
      await step.run("mark-failed", () =>
        updateJobStatus({
          accountId,
          jobId: job.id,
          status: "FAILED",
          results: { error: result.error },
        })
      );
    }

    return result;
  }
);

// Thin inngest.send wrapper — the natural pairing for the function it
// triggers, called by the OAuth callback route right after a store is
// connected (context/00-build-plan.md Unit 7: "on first connect").
export async function triggerStoreImport(input: {
  accountId: string;
  storeId: string;
  shopifyDomain: string;
}): Promise<void> {
  await inngest.send({
    name: "store/connected",
    data: input,
  });
}
