import { inngest } from "@/lib/jobs/client";
import { updateJobStatus } from "@/lib/db/jobs";
import { getStoreToken } from "@/lib/db/stores";
import { deleteProducts as deleteProductsFromDb, getProductById } from "@/lib/db/products";
import { decryptAccessToken } from "@/lib/shopify/oauth";
import { deleteProductFromShopify } from "@/lib/shopify/delete";
import { deleteProductImage, isBlobUrl } from "@/lib/blob/products";

export type DeleteOneProductResult = { success: true } | { success: false; step: string; error: string };

// Mirrors lib/jobs/push.ts's pushOneProduct shape exactly (load product/token ->
// call Shopify -> only touch the local row once the Shopify side is confirmed).
// Deliberately never deletes the local row first: if the Shopify call fails, the
// local row has to stay, or the app would lose its own record of a product
// that's still live on Shopify with no way back to it short of a full re-sync.
export async function deleteOneProduct(input: {
  accountId: string;
  storeId: string;
  productId: string;
}): Promise<DeleteOneProductResult> {
  const { accountId, storeId, productId } = input;

  const product = await getProductById(accountId, productId);
  if (!product) {
    return { success: false, step: "load-product", error: "Product no longer exists" };
  }
  if (!product.shopifyProductId) {
    return { success: false, step: "no-shopify-id", error: "This product was never pushed to Shopify" };
  }

  const tokenRecord = await getStoreToken(accountId, storeId);
  if (!tokenRecord) {
    return { success: false, step: "load-token", error: "Store or token not found" };
  }
  const accessToken = decryptAccessToken(tokenRecord.accessTokenEncrypted);

  const deleted = await deleteProductFromShopify(tokenRecord.shopifyDomain, accessToken, product.shopifyProductId);
  if (!deleted.success) {
    return { success: false, step: "shopify-delete", error: deleted.error };
  }

  // The product record — and any recollection of its images — is going
  // away entirely now, so any still-Blob-hosted draft image is cleaned up
  // rather than left orphaned in storage. Unconditional here (unlike
  // push's invariant-8 cleanup, which only applies to images that got
  // replaced), since nothing will ever reference these again either way.
  for (const url of product.imageUrls.filter(isBlobUrl)) {
    const removed = await deleteProductImage(url);
    if (!removed.success) {
      console.error(`deleteOneProduct: Blob cleanup failed for ${url}: ${removed.error}`);
    }
  }

  // deleteProductsFromDb's count can legitimately be 0 here (e.g. a retried
  // job racing a second delete attempt) — not a failure from the caller's
  // perspective, since the end state (no product on Shopify, no local row)
  // is already achieved.
  await deleteProductsFromDb({ accountId, productIds: [productId] });

  return { success: true };
}

// Mirrors lib/jobs/push.ts's triggerProductPush — the server action
// (deleteProductEverywhere in app/(dashboard)/products/actions.ts) creates
// the Job row first so it has a jobId to return for the confirmation dialog's polling.
export async function triggerProductDelete(input: {
  accountId: string;
  storeId: string;
  productId: string;
  jobId: string;
}): Promise<void> {
  await inngest.send({ name: "product/delete.requested", data: input });
}

export const deleteProductJob = inngest.createFunction(
  { id: "delete-product", triggers: { event: "product/delete.requested" } },
  async ({ event, step }) => {
    const { accountId, storeId, productId, jobId } = event.data as {
      accountId: string;
      storeId: string;
      productId: string;
      jobId: string;
    };

    await step.run("mark-running", () => updateJobStatus({ accountId, jobId, status: "RUNNING" }));

    const result = await step.run("delete-from-shopify", () =>
      deleteOneProduct({ accountId, storeId, productId })
    );

    await step.run(result.success ? "mark-succeeded" : "mark-failed", () =>
      updateJobStatus({
        accountId,
        jobId,
        status: result.success ? "SUCCEEDED" : "FAILED",
        results: result.success ? { productId } : { productId, failedStep: result.step, error: result.error },
      })
    );

    return result;
  }
);
