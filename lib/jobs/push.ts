import { inngest } from "@/lib/jobs/client";
import { updateJobStatus } from "@/lib/db/jobs";
import { getStoreToken } from "@/lib/db/stores";
import { getProductById, markProductPushed } from "@/lib/db/products";
import { decryptAccessToken } from "@/lib/shopify/oauth";
import { pushProductToShopify, type PushProductInput } from "@/lib/shopify/push";
import { deleteProductImage, isBlobUrl } from "@/lib/blob/products";
import type { Product } from "@/types/product";
import type { PushBatchResultItem } from "@/types/job";

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
    categoryId: product.categoryId,
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

export type PushOneProductResult =
  | { success: true; shopifyProductId: string }
  | { success: false; step: string; error: string };

// Unit 16: extracted verbatim from pushProductJob's former inline
// "push-to-shopify" step callback so pushBatchJob (below) can reuse the
// exact same single-product push logic — load product/token, call Shopify,
// save the result, clean up Blob images — instead of duplicating it. No
// behavior change for the single-push path: pushProductJob still calls this
// inside a step.run with the same step id and the same return shape.
export async function pushOneProduct(input: {
  accountId: string;
  storeId: string;
  productId: string;
}): Promise<PushOneProductResult> {
  const { accountId, storeId, productId } = input;

  const product = await getProductById(accountId, productId);
  if (!product) {
    return { success: false, step: "load-product", error: "Product no longer exists" };
  }

  const tokenRecord = await getStoreToken(accountId, storeId);
  if (!tokenRecord) {
    return { success: false, step: "load-token", error: "Store or token not found" };
  }
  const accessToken = decryptAccessToken(tokenRecord.accessTokenEncrypted);

  const pushed = await pushProductToShopify(tokenRecord.shopifyDomain, accessToken, toPushInput(product));
  if (!pushed.success) {
    return { success: false, step: "shopify-push", error: pushed.error };
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
    return { success: false, step: "save-result", error: "Failed to save push result" };
  }

  // Invariant 8: only delete each Blob copy now that the new imageUrls are
  // durably saved on the product record. Looped per-image, not an
  // all-or-nothing batch — a delete failure logs but doesn't fail the push
  // itself, since Shopify already has the image; an orphaned Blob file is a
  // cleanup miss, not a push failure.
  for (const url of product.imageUrls.filter(isBlobUrl)) {
    const deleted = await deleteProductImage(url);
    if (!deleted.success) {
      console.error(`pushOneProduct: Blob cleanup failed for ${url}: ${deleted.error}`);
    }
  }

  return { success: true, shopifyProductId: pushed.data.shopifyProductId };
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

    const result = await step.run("push-to-shopify", () => pushOneProduct({ accountId, storeId, productId }));

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

// Unit 16: the one piece of genuinely new business logic in the batch push
// — decides the job's overall status from each product's individual
// outcome. Pure and independently testable (tests/lib/jobs/push.test.ts).
// Precondition: items is non-empty — pushSelectedProducts (the server
// action) never enqueues a batch job with zero productIds.
export function computeBatchJobStatus(items: PushBatchResultItem[]): "SUCCEEDED" | "FAILED" | "PARTIAL" {
  const succeeded = items.filter((item) => item.success).length;
  if (succeeded === items.length) return "SUCCEEDED";
  if (succeeded === 0) return "FAILED";
  return "PARTIAL";
}

// Unit 16: mirrors triggerProductPush's pattern — the caller (the
// pushSelectedProducts server action) already created the Job row, this
// just fans the event out to Inngest.
export async function triggerBatchPush(input: {
  accountId: string;
  storeId: string;
  jobId: string;
  productIds: string[];
}): Promise<void> {
  await inngest.send({
    name: "product/push-batch.requested",
    data: input,
  });
}

export const pushBatchJob = inngest.createFunction(
  { id: "push-batch", triggers: { event: "product/push-batch.requested" } },
  async ({ event, step }) => {
    const { accountId, storeId, jobId, productIds } = event.data as {
      accountId: string;
      storeId: string;
      jobId: string;
      productIds: string[];
    };

    await step.run("mark-running", () => updateJobStatus({ accountId, jobId, status: "RUNNING" }));

    const items: PushBatchResultItem[] = [];
    // Sequential, not Promise.all: even with Unit 22's shared
    // lib/shopify/client.ts now absorbing individual rate-limit responses
    // with retry-with-backoff, that budget is shared across the whole store
    // — firing many products' multi-call push sequences at Shopify
    // concurrently within one job run would still burn through it faster
    // than sequential requests do, just with each one separately eating its
    // own retries instead of naturally pacing against the shared limit.
    // Each product gets its own step id (`push-product-${productId}`), so
    // Inngest memoizes it individually — if this function is retried after
    // a crash mid-batch, already-succeeded products aren't re-pushed.
    for (const productId of productIds) {
      const result = await step.run(`push-product-${productId}`, () =>
        pushOneProduct({ accountId, storeId, productId })
      );
      items.push(
        result.success
          ? { productId, success: true, shopifyProductId: result.shopifyProductId }
          : { productId, success: false, failedStep: result.step, error: result.error }
      );
    }

    const status = computeBatchJobStatus(items);
    await step.run("mark-complete", () => updateJobStatus({ accountId, jobId, status, results: { items } }));

    return { status, items };
  }
);
