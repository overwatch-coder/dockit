"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import {
  addProductImage as addProductImageInDb,
  createProduct as createProductInDb,
  deleteProducts as deleteProductsFromDb,
  getEligibleUnsyncedProducts,
  getProductById,
  getProductsForStatusSync,
  getUnsyncedProductIdsForStore,
  removeProductImage as removeProductImageInDb,
  resolveConflictKeepShopify as resolveConflictKeepShopifyInDb,
  updateProduct as updateProductInDb,
  updateProductsStatus as updateProductsStatusInDb,
} from "@/lib/db/products";
import { syncProductVariants as syncProductVariantsInDb } from "@/lib/db/variants";
import { getStoresForAccount, getStoreToken } from "@/lib/db/stores";
import { createJob, getJobById } from "@/lib/db/jobs";
import {
  deleteProductImage as deleteProductImageFromBlob,
  isBlobUrl,
  uploadProductImage as uploadProductImageToBlob,
} from "@/lib/blob/products";
import { decryptAccessToken } from "@/lib/shopify/oauth";
import { fetchAllCollections } from "@/lib/shopify/collections";
import {
  generateProductDescription as generateProductDescriptionSuggestion,
  suggestProductSeo as generateProductSuggestion,
} from "@/lib/ai/suggestions";
import { triggerBatchPush, triggerProductPush } from "@/lib/jobs/push";
import { triggerProductDelete } from "@/lib/jobs/delete";
import { triggerStoreSync } from "@/lib/jobs/import";
import { productFormSchema } from "@/lib/validation/product";
import { variantFormSchema } from "@/lib/validation/variant";
import type { AiSuggestion, ProductDescriptionSuggestion } from "@/lib/validation/ai-suggestion";
import { sanitizeDescriptionHtml } from "@/lib/sanitize-description";
import type { Collection } from "@/types/collection";
import type { JobStatus } from "@/types/job";

// Matches the shape components/variant-list.tsx submits: id is either a
// real variant id or a client-generated temporary id for a not-yet-created
// row — lib/db/variants.ts's syncProductVariants tells them apart by
// checking against the product's actual current variant ids, not by
// inspecting the id's format here.
const variantsFieldSchema = z.array(variantFormSchema.extend({ id: z.string().min(1) }));

// Unit 13: tags are staged client-side the same way variants are — a hidden
// JSON field, parsed and fully replaced on each save rather than diffed.
const tagsFieldSchema = z.array(z.string().trim().min(1)).max(20, "No more than 20 tags");

// Deletes from the app's own database only — there is no Shopify delete
// mutation yet (lib/shopify/products.ts only reads). If the product still
// exists on Shopify, a future sync would simply re-import it. Used for both
// a single product and a bulk selection from the product list.
export async function deleteProducts(productIds: string[]): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const { deletedCount } = await deleteProductsFromDb({ accountId: account.id, productIds });
  if (deletedCount === 0) {
    return { error: "Those products were already removed." };
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export type ProductFormState =
  | { error?: string; fieldErrors?: Partial<Record<"title" | "description" | "price" | "status", string>> }
  | { success: true }
  | undefined;

type ProductFieldErrors = Partial<Record<"title" | "description" | "price" | "status", string>>;

function parseProductForm(
  formData: FormData
): { fieldErrors: ProductFieldErrors } | ReturnType<typeof productFormSchema.parse> {
  const parsed = productFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    price: formData.get("price"),
    status: formData.get("status"),
    collectionId: formData.get("collectionId") ?? undefined,
    collectionTitle: formData.get("collectionTitle") ?? undefined,
    seoTitle: formData.get("seoTitle") ?? undefined,
    seoDescription: formData.get("seoDescription") ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors: ProductFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as "title" | "description" | "price" | "status" | undefined;
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { fieldErrors };
  }

  return parsed.data;
}

// Unit 10: creates a brand-new local-only draft product (shopifyProductId
// stays null until a future push — Units 15-17). storeId is bound via
// createProduct.bind(null, storeId) from the client form since it isn't
// part of the form's own fields.
export async function createProduct(
  storeId: string,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const parsed = parseProductForm(formData);
  if ("fieldErrors" in parsed) {
    return parsed;
  }

  const product = await createProductInDb({
    accountId: account.id,
    storeId,
    title: parsed.title,
    description: sanitizeDescriptionHtml(parsed.description),
    price: parsed.price,
    status: parsed.status,
  });

  revalidatePath("/products");
  revalidatePath("/dashboard");
  redirect(`/products/${product.id}`);
}

// Unit 10: edits a product's core fields. productId is bound via
// updateProduct.bind(null, productId) from the client form.
//
// Unit 11 follow-up, per explicit user request: variants are staged
// client-side and only reach the database here, alongside the product's own
// fields — reconciled in one call to syncProductVariants rather than the
// three separate immediate-persist add/update/delete actions this
// superseded, so nothing about a variant saves until this button is
// pressed, same as title/price/status/description.
export async function updateProduct(
  productId: string,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const parsed = parseProductForm(formData);
  if ("fieldErrors" in parsed) {
    return parsed;
  }

  const variantsRaw = formData.get("variants");
  let variantsInput: z.infer<typeof variantsFieldSchema> = [];
  if (typeof variantsRaw === "string" && variantsRaw.length > 0) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(variantsRaw);
    } catch {
      return { error: "Variant data was malformed. Try again." };
    }
    const parsedVariants = variantsFieldSchema.safeParse(parsedJson);
    if (!parsedVariants.success) {
      return { error: parsedVariants.error.issues[0]?.message ?? "One or more variants are invalid." };
    }
    variantsInput = parsedVariants.data;
  }

  const tagsRaw = formData.get("tags");
  let tagsInput: z.infer<typeof tagsFieldSchema> = [];
  if (typeof tagsRaw === "string" && tagsRaw.length > 0) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(tagsRaw);
    } catch {
      return { error: "Tag data was malformed. Try again." };
    }
    const parsedTags = tagsFieldSchema.safeParse(parsedJson);
    if (!parsedTags.success) {
      return { error: parsedTags.error.issues[0]?.message ?? "One or more tags are invalid." };
    }
    tagsInput = parsedTags.data;
  }

  const product = await updateProductInDb({
    accountId: account.id,
    productId,
    title: parsed.title,
    description: sanitizeDescriptionHtml(parsed.description),
    price: parsed.price,
    status: parsed.status,
    collectionId: parsed.collectionId || null,
    collectionTitle: parsed.collectionTitle || null,
    tags: tagsInput,
    seoTitle: parsed.seoTitle || null,
    seoDescription: parsed.seoDescription || null,
  });
  if (!product) {
    return { error: "This product no longer exists." };
  }

  const variantsResult = await syncProductVariantsInDb({
    accountId: account.id,
    productId,
    variants: variantsInput,
  });
  if (!variantsResult) {
    return { error: "This product no longer exists." };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Unit 12: uploads a draft-state image to Vercel Blob and adds it to the
// product's gallery. Unlike title/price/status/variants, this is an
// immediate action, not staged behind the main Save button — an upload has
// to actually complete against Blob before there's a URL to show at all, so
// there's nothing meaningful to "stage" client-side the way a plain text
// edit can be.
export async function uploadProductImage(
  productId: string,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Only JPEG, PNG, WebP, or GIF images are supported." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Images must be 5MB or smaller." };
  }

  const uploaded = await uploadProductImageToBlob({ productId, file });
  if (!uploaded.success) {
    return { error: uploaded.error };
  }

  const product = await addProductImageInDb({ accountId: account.id, productId, url: uploaded.url });
  if (!product) {
    return { error: "This product no longer exists." };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}

// Unit 12: removes one image from the gallery — a draft Blob upload gets
// actually deleted from storage; a Shopify-imported image is just removed
// from the list (there's nothing in Blob to delete for it, and this never
// touches Shopify itself, per the unit's own "no Shopify interaction" scope).
export async function removeProductImage(
  productId: string,
  url: string
): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (isBlobUrl(url)) {
    const deleted = await deleteProductImageFromBlob(url);
    if (!deleted.success) {
      return { error: deleted.error };
    }
  }

  const product = await removeProductImageInDb({ accountId: account.id, productId, url });
  if (!product) {
    return { error: "This product no longer exists." };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}

// Unit 14: fetches an AI suggestion for a product's SEO title/description,
// tags, and collection. Deliberately does NOT persist anything or call
// revalidatePath — per architecture.md invariant 7, AI-generated content is
// only ever returned as a suggestion; it's written to the product record
// the same way any other edit is, only when the owner presses Save.
export async function suggestProductSeo(
  productId: string
): Promise<{ success: true; data: AiSuggestion } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const product = await getProductById(account.id, productId);
  if (!product) {
    return { error: "This product no longer exists." };
  }

  // Same fetch sequence as app/(dashboard)/products/[id]/page.tsx — fails
  // open to an empty list rather than blocking the suggestion entirely.
  let collections: Collection[] = [];
  const storeToken = await getStoreToken(account.id, product.storeId);
  if (storeToken) {
    const accessToken = decryptAccessToken(storeToken.accessTokenEncrypted);
    const result = await fetchAllCollections(storeToken.shopifyDomain, accessToken);
    if (result.success) {
      collections = result.data;
    }
  }

  const suggestion = await generateProductSuggestion({
    title: product.title,
    description: product.description,
    price: product.price,
    tags: product.tags,
    collections,
  });
  if (!suggestion.success) {
    return { error: suggestion.error };
  }

  return { success: true, data: suggestion.data };
}

// Unit 16: generates or improves a product description via AI. Deliberately
// takes no productId — it works from whatever's currently staged in the
// form (title/price/description), so it's usable on /products/new before a
// product row even exists, not just in edit mode. Only auth-gated, same as
// every other action; nothing is persisted here (architecture.md invariant
// 7 — the owner applies it in the editor and it's only saved on Save).
export async function generateProductDescription(input: {
  title: string;
  price: string;
  existingDescriptionHtml: string | null;
  instructions: string;
}): Promise<{ success: true; data: ProductDescriptionSuggestion } | { error: string }> {
  await auth.protect();

  if (!input.title.trim()) {
    return { error: "Enter a product title first." };
  }

  const result = await generateProductDescriptionSuggestion(input);
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true, data: result.data };
}

// Unit 15: enqueues a push job — never calls Shopify itself (architecture.md
// invariants 4/5). The Job row is created here (not inside pushProductJob,
// unlike the import job's own pattern) so its id can be returned
// synchronously for the Push button's polling.
export async function pushProduct(productId: string): Promise<{ jobId: string } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const product = await getProductById(account.id, productId);
  if (!product) {
    return { error: "This product no longer exists." };
  }

  const job = await createJob({ accountId: account.id, storeId: product.storeId, type: "PUSH" });
  await triggerProductPush({ accountId: account.id, storeId: product.storeId, productId, jobId: job.id });

  return { jobId: job.id };
}

// Unit 16: mirrors pushProduct's shape — never calls Shopify itself
// (architecture.md invariant 4). Operates on a caller-supplied selection
// (components/product-table.tsx's existing row-selection UI), not an
// implicit "every unsynced product" filter, per explicit product decision.
// Eligibility, corrected per explicit user feedback: whether a product has
// ever reached Shopify (shopifyProductId === null) — NOT its local DRAFT/
// ACTIVE status, which is independent. A product that's locally DRAFT but
// was already pushed once is not re-pushed here, since that would silently
// overwrite whatever's currently live; republishing an already-synced
// product stays the single-product editor's explicit Republish button. The
// account-scoped eligibility check is defense in depth: the client already
// pre-filters its selection, but state could theoretically change between
// page load and click.
export async function pushSelectedProducts(
  productIds: string[]
): Promise<{ jobId: string; count: number } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (productIds.length === 0) {
    return { error: "No products selected." };
  }

  const eligible = await getEligibleUnsyncedProducts(account.id, productIds);
  if (eligible.length === 0) {
    return { error: "None of the selected products are new — they've already been pushed to Shopify." };
  }

  const storeId = eligible[0].storeId;
  const eligibleIds = eligible.map((product) => product.id);

  const job = await createJob({ accountId: account.id, storeId, type: "PUSH" });
  await triggerBatchPush({ accountId: account.id, storeId, jobId: job.id, productIds: eligibleIds });

  return { jobId: job.id, count: eligibleIds.length };
}

// Unit 16 follow-up: the no-selection counterpart to pushSelectedProducts —
// pushes every product for the current store that's never reached Shopify.
// Store scope matches products/page.tsx's own "first connected store"
// convention (Unit 21 replaces both with the real switcher selection). Zero
// eligible products is a typed error, not a job — nothing to enqueue.
export async function pushAllDrafts(): Promise<{ jobId: string; count: number } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const stores = await getStoresForAccount(account.id);
  const store = stores[0];
  if (!store) {
    return { error: "Connect a store first." };
  }

  const productIds = await getUnsyncedProductIdsForStore(account.id, store.id);
  if (productIds.length === 0) {
    return { error: "Every product has already been pushed to Shopify." };
  }

  const job = await createJob({ accountId: account.id, storeId: store.id, type: "PUSH" });
  await triggerBatchPush({ accountId: account.id, storeId: store.id, jobId: job.id, productIds });

  return { jobId: job.id, count: productIds.length };
}

// Unit 17: the "Sync Store" trigger — pulls the store's current Shopify
// catalog into the database. A product with an unpushed local edit
// (lastEditedAt after lastSyncedAt) is left untouched by the job itself
// (lib/db/products.ts's syncProducts/shouldSkipSync), not flagged as a
// Conflict yet (that's Unit 18). Store scope matches pushAllDrafts' own
// "first connected store" convention (Unit 21 replaces both with the real
// switcher selection). Creates the Job row itself, same as every other
// dashboard-button-triggered job, so the button can poll it (invariant 4:
// never calls Shopify here, only enqueues).
export async function syncStore(): Promise<{ jobId: string } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const stores = await getStoresForAccount(account.id);
  const store = stores[0];
  if (!store) {
    return { error: "Connect a store first." };
  }

  const job = await createJob({ accountId: account.id, storeId: store.id, type: "SYNC" });
  await triggerStoreSync({
    accountId: account.id,
    storeId: store.id,
    shopifyDomain: store.shopifyDomain,
    jobId: job.id,
  });

  return { jobId: job.id };
}

// Unit 16 follow-up: changes one or more products' status directly from the
// products list (a single row's dropdown, or a bulk selection) with an
// explicit choice of whether to also sync that change to Shopify right now
// — never calls Shopify itself here (invariant 4); syncToShopify just
// chains into the same batch push machinery pushSelectedProducts uses.
// Unlike pushSelectedProducts, this is not limited to never-synced
// products: the whole point is pushing a status change onto a product that
// may already be live.
export async function setProductsStatus(
  productIds: string[],
  status: "DRAFT" | "ACTIVE",
  syncToShopify: boolean
): Promise<{ jobId?: string; count: number } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (productIds.length === 0) {
    return { error: "No products selected." };
  }

  const { updatedCount } = await updateProductsStatusInDb({ accountId: account.id, productIds, status });
  if (updatedCount === 0) {
    return { error: "Those products no longer exist." };
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");

  if (!syncToShopify) {
    return { count: updatedCount };
  }

  const eligible = await getProductsForStatusSync(account.id, productIds);
  if (eligible.length === 0) {
    // Status was still updated locally — just nothing left to sync (every
    // matched product is conflicted). Not an error: the local change
    // already succeeded.
    return { count: updatedCount };
  }

  const storeId = eligible[0].storeId;
  const eligibleIds = eligible.map((product) => product.id);

  const job = await createJob({ accountId: account.id, storeId, type: "PUSH" });
  await triggerBatchPush({ accountId: account.id, storeId, jobId: job.id, productIds: eligibleIds });

  return { jobId: job.id, count: eligibleIds.length };
}

// Unit 16 follow-up, per explicit user request: a genuinely destructive
// action distinct from deleteProducts (above), which only ever touches
// Dockit's own database — this permanently removes the product from
// Shopify too. Gated client-side by
// components/delete-from-shopify-dialog.tsx's type-the-product-name
// confirmation before this is ever called. Never calls Shopify itself here
// (invariant 4) — just enqueues the job, same shape as pushProduct.
export async function deleteProductEverywhere(productId: string): Promise<{ jobId: string } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const product = await getProductById(account.id, productId);
  if (!product) {
    return { error: "This product no longer exists." };
  }
  if (!product.shopifyProductId) {
    return { error: "This product was never pushed to Shopify." };
  }

  const job = await createJob({ accountId: account.id, storeId: product.storeId, type: "DELETE" });
  await triggerProductDelete({ accountId: account.id, storeId: product.storeId, productId, jobId: job.id });

  return { jobId: job.id };
}

// Unit 19: the "Keep Shopify version" conflict resolution — a pure local
// write (lib/db/products.ts's resolveConflictKeepShopify never calls
// Shopify, invariant 1). The "Keep app version" counterpart needs no
// dedicated action at all: it's just the existing pushProduct above, since
// markProductPushed now clears the conflict fields on any successful push.
export async function resolveConflictKeepShopify(productId: string): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const result = await resolveConflictKeepShopifyInDb({ accountId: account.id, productId });
  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/dashboard");
}

// Unit 15: a plain polling read for the Push button's own inline status —
// no revalidatePath here, since nothing server-rendered changes per poll
// tick; the client refreshes itself once it observes SUCCEEDED. Generic by
// implementation despite the push-specific name — reused as-is by the
// delete job's polling too (renaming would touch every already-tested call
// site for no functional gain).
export async function getPushJobStatus(
  jobId: string
): Promise<{ status: JobStatus; results: unknown } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const job = await getJobById(account.id, jobId);
  if (!job) {
    return { error: "Job not found." };
  }

  return { status: job.status, results: job.results };
}
