import { inngest } from "@/lib/jobs/client";
import { createJob, updateJobStatus } from "@/lib/db/jobs";
import { getStoreToken, markStoreDisconnected } from "@/lib/db/stores";
import { importProducts, syncProducts } from "@/lib/db/products";
import { decryptAccessToken } from "@/lib/shopify/oauth";
import { fetchAllProducts, fetchProductsByIds } from "@/lib/shopify/products";

type FetchAndImportResult =
  | { success: true; importedCount: number }
  | { success: false; error: string };

// Extracted verbatim from importStoreProductsJob's former inline
// "fetch-and-import" step callback — no behavior change, just lifted out of
// the closure so Unit 17's syncStoreJob (below) can share the token-load +
// Shopify-fetch half without duplicating it. importStoreProductsJob still
// calls this inside the same step.run with the same step id and return
// shape.
async function fetchAndImport(input: {
  accountId: string;
  storeId: string;
  shopifyDomain: string;
}): Promise<FetchAndImportResult> {
  const tokenRecord = await getStoreToken(input.accountId, input.storeId);
  if (!tokenRecord) {
    await markStoreDisconnected(input.storeId);
    return { success: false, error: "Store or token not found" };
  }

  const accessToken = decryptAccessToken(tokenRecord.accessTokenEncrypted);
  const fetched = await fetchAllProducts(input.shopifyDomain, accessToken);
  if (!fetched.success) {
    if (fetched.status === 401 || fetched.status === 404) {
      await markStoreDisconnected(input.storeId);
    }
    return { success: false, error: fetched.error };
  }

  const { importedCount } = await importProducts({
    accountId: input.accountId,
    storeId: input.storeId,
    products: fetched.data,
  });
  return { success: true, importedCount };
}

// Fires once per store connection (see triggerStoreImport below), pulling
// the store's full catalog into Postgres. Uses JobType "SYNC" — the schema's
// JobType is deliberately just PUSH | SYNC | DELETE (context/00-build-plan.md
// Unit 2/6), and an initial import is a pull from Shopify like Unit 17's
// sync, just for a brand-new store instead of a re-sync. Unlike syncStoreJob
// below, this job creates its own Job row (see the "create-job" step) —
// there's no UI polling this at OAuth-callback time, so there's no jobId to
// hand back to anything.
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

    const result = await step.run("fetch-and-import", () =>
      fetchAndImport({ accountId, storeId, shopifyDomain })
    );

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

type FetchAndSyncResult =
  | { success: true; syncedCount: number; conflictedCount: number; errorCount: number }
  | { success: false; error: string };

// Unit 17: the re-sync counterpart of fetchAndImport above. Can sync either
// the full catalog or a specific caller-provided selection of product IDs.
async function fetchAndSync(input: {
  accountId: string;
  storeId: string;
  shopifyDomain: string;
  productIds?: string[];
}): Promise<FetchAndSyncResult> {
  const tokenRecord = await getStoreToken(input.accountId, input.storeId);
  if (!tokenRecord) {
    await markStoreDisconnected(input.storeId);
    return { success: false, error: "Store or token not found" };
  }

  const accessToken = decryptAccessToken(tokenRecord.accessTokenEncrypted);
  const fetched =
    input.productIds && input.productIds.length > 0
      ? await fetchProductsByIds(input.shopifyDomain, accessToken, input.productIds)
      : await fetchAllProducts(input.shopifyDomain, accessToken);

  if (!fetched.success) {
    if (fetched.status === 401 || fetched.status === 404) {
      await markStoreDisconnected(input.storeId);
    }
    return { success: false, error: fetched.error };
  }

  const { syncedCount, conflictedCount, errorCount } = await syncProducts({
    accountId: input.accountId,
    storeId: input.storeId,
    products: fetched.data,
  });
  return { success: true, syncedCount, conflictedCount, errorCount };
}

// Unit 17: mirrors triggerProductPush's pattern — the caller
// (syncStore in app/(dashboard)/products/actions.ts) creates the Job row
// itself, since this is triggered from a "Sync Store" button that needs a
// jobId back synchronously to poll. Supports optional productIds for selective sync.
export async function triggerStoreSync(input: {
  accountId: string;
  storeId: string;
  shopifyDomain: string;
  jobId: string;
  productIds?: string[];
}): Promise<void> {
  await inngest.send({
    name: "store/sync.requested",
    data: input,
  });
}

export const syncStoreJob = inngest.createFunction(
  { id: "sync-store", triggers: { event: "store/sync.requested" } },
  async ({ event, step }) => {
    const { accountId, storeId, shopifyDomain, jobId, productIds } = event.data as {
      accountId: string;
      storeId: string;
      shopifyDomain: string;
      jobId: string;
      productIds?: string[];
    };

    try {
      await step.run("mark-running", () => updateJobStatus({ accountId, jobId, status: "RUNNING" }));

      const result = await step.run("fetch-and-sync", () =>
        fetchAndSync({ accountId, storeId, shopifyDomain, productIds })
      );


      if (result.success) {
        await step.run("mark-succeeded", () =>
          updateJobStatus({
            accountId,
            jobId,
            status: "SUCCEEDED",
            results: {
              syncedCount: result.syncedCount,
              conflictedCount: result.conflictedCount,
              errorCount: result.errorCount,
            },
          })
        );
      } else {
        console.error(`syncStoreJob failed for account ${accountId}, store ${storeId}: ${result.error}`);
        await step.run("mark-failed", () =>
          updateJobStatus({ accountId, jobId, status: "FAILED", results: { error: result.error } })
        );
      }

      return result;
    } catch (unhandledErr) {
      const errMessage =
        unhandledErr instanceof Error ? unhandledErr.message : "Sync job crashed unexpectedly";
      console.error(`syncStoreJob crashed for account ${accountId}, store ${storeId}:`, unhandledErr);
      await updateJobStatus({ accountId, jobId, status: "FAILED", results: { error: errMessage } });
      throw unhandledErr;
    }
  }
);
