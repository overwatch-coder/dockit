import { inngest } from "@/lib/jobs/client";
import { updateJobStatus } from "@/lib/db/jobs";
import { getStoreToken } from "@/lib/db/stores";
import { getProductById, markProductPushed } from "@/lib/db/products";
import { decryptAccessToken } from "@/lib/shopify/oauth";
import { pushProductToShopify, type PushProductInput } from "@/lib/shopify/push";
import { deleteProductImage, isBlobUrl } from "@/lib/blob/products";
import type { Product } from "@/types/product";

function toPushInput(product: Product): PushProductInput {
  return {
    shopifyProductId: product.shopifyProductId,
    title: product.title,
    descriptionHtml: product.description,
    status: product.status,
    tags: product.tags,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    price: product.price,
    collectionId: product.collectionId,
    imageUrls: product.imageUrls,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      shopifyVariantId: variant.shopifyVariantId,
      optionName: variant.optionName,
      price: variant.price,
      inventory: variant.inventory,
    })),
  };
}

// Unit 15: unlike lib/jobs/import.ts's noopJob/importStoreProductsJob, this
// job does NOT create its own Job row — the server action (pushProduct in
// app/(dashboard)/products/actions.ts) creates it first so it has a jobId to
// return for the Push button's polling. This function only transitions an
// already-existing job.
export async function triggerProductPush(input: {
  accountId: string;
  storeId: string;
  productId: string;
  jobId: string;
}): Promise<void> {
  await inngest.send({
    name: "product/push.requested",
    data: input,
  });
}

export const pushProductJob = inngest.createFunction(
  { id: "push-product", triggers: { event: "product/push.requested" } },
  async ({ event, step }) => {
    const { accountId, storeId, productId, jobId } = event.data as {
      accountId: string;
      storeId: string;
      productId: string;
      jobId: string;
    };

    await step.run("mark-running", () => updateJobStatus({ accountId, jobId, status: "RUNNING" }));

    const result = await step.run("push-to-shopify", async () => {
      const product = await getProductById(accountId, productId);
      if (!product) {
        return { success: false as const, step: "load-product", error: "Product no longer exists" };
      }

      const tokenRecord = await getStoreToken(accountId, storeId);
      if (!tokenRecord) {
        return { success: false as const, step: "load-token", error: "Store or token not found" };
      }
      const accessToken = decryptAccessToken(tokenRecord.accessTokenEncrypted);

      const pushed = await pushProductToShopify(tokenRecord.shopifyDomain, accessToken, toPushInput(product));
      if (!pushed.success) {
        return { success: false as const, step: "shopify-push", error: pushed.error };
      }

      const dbUpdate = await markProductPushed({
        accountId,
        productId,
        shopifyProductId: pushed.data.shopifyProductId,
        imageUrl: pushed.data.mediaUrls[0] ?? null,
        imageUrls: pushed.data.mediaUrls,
        variants: pushed.data.variants,
      });
      if (!dbUpdate.updated) {
        return { success: false as const, step: "save-result", error: "Failed to save push result" };
      }

      // Invariant 8: only delete each Blob copy now that the new imageUrls
      // are durably saved on the product record. Looped per-image, not an
      // all-or-nothing batch — a delete failure logs but doesn't fail the
      // push itself, since Shopify already has the image; an orphaned Blob
      // file is a cleanup miss, not a push failure.
      for (const url of product.imageUrls.filter(isBlobUrl)) {
        const deleted = await deleteProductImage(url);
        if (!deleted.success) {
          console.error(`pushProductJob: Blob cleanup failed for ${url}: ${deleted.error}`);
        }
      }

      return { success: true as const, shopifyProductId: pushed.data.shopifyProductId };
    });

    await step.run(result.success ? "mark-succeeded" : "mark-failed", () =>
      updateJobStatus({
        accountId,
        jobId,
        status: result.success ? "SUCCEEDED" : "FAILED",
        results: result.success
          ? { productId, shopifyProductId: result.shopifyProductId }
          : { productId, failedStep: result.step, error: result.error },
      })
    );

    return result;
  }
);
