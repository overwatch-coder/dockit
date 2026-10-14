"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { ACTIVE_STORE_COOKIE_NAME } from "@/lib/active-store-cookie";
import {
  addProductImage as addProductImageInDb,
  applyBulkAiSuggestions as applyBulkAiSuggestionsInDb,
  applyFullAiEnrichmentInDb,
  createProduct as createProductInDb,
  deleteProducts as deleteProductsFromDb,
  duplicateProduct as duplicateProductInDb,
  getEligibleUnsyncedProducts,
  getExistingShopifyProductIds,
  getPaginatedProductsForStore,
  getProductById,
  getProductsByIds,
  getProductsForStatusSync,
  getUnsyncedProductIdsForStore,
  removeProductImage as removeProductImageInDb,
  resolveConflictWithSelections as resolveConflictWithSelectionsInDb,
  updateProduct as updateProductInDb,
  updateProductsStatus as updateProductsStatusInDb,
} from "@/lib/db/products";
import { buildProductsCsv } from "@/lib/csv/products";
import type { ConflictFieldSelections } from "@/lib/db/products";
import { syncProductVariants as syncProductVariantsInDb } from "@/lib/db/variants";
import {
  getActiveStoreForAccount,
  getStoresForAccount,
  getStoreToken,
} from "@/lib/db/stores";
import {
  createJob,
  getJobById,
  getLatestJobForStore,
  updateJobStatus,
} from "@/lib/db/jobs";
import {
  deleteProductImage as deleteProductImageFromBlob,
  isBlobUrl,
  uploadProductImage as uploadProductImageToBlob,
} from "@/lib/blob/products";
import { decryptAccessToken } from "@/lib/shopify/oauth";
import { fetchAllCollections } from "@/lib/shopify/collections";
import { previewShopifyProducts } from "@/lib/shopify/products";
import {
  fetchCategoryAttributes,
  fetchProductMetafieldDefinitions,
  type CategoryAttributeDefinition,
  type ProductMetafieldDefinition,
} from "@/lib/shopify/metafields";
import {
  searchTaxonomyCategories,
  type ShopifyTaxonomyCategory,
} from "@/lib/shopify/taxonomy";
import {
  generateProductDescription as generateProductDescriptionSuggestion,
  suggestProductSeo as generateProductSuggestion,
} from "@/lib/ai/suggestions";
import { runFullProductAiVisionEnrichment } from "@/lib/ai/vision-enrichment";
import { getAiRulesForStore } from "@/lib/db/ai-rules";
import type {
  FullAiVisionEnrichmentResult,
  EnrichedProductFields,
} from "@/lib/validation/ai-vision-enrichment";
import type {
  TextVisionProviderName,
  ImageProviderName,
  ImageAspectRatio,
  ImageGenerationMode,
} from "@/lib/ai/contracts";
import { triggerBatchPush, triggerProductPush } from "@/lib/jobs/push";
import { triggerProductDelete } from "@/lib/jobs/delete";
import { triggerStoreSync } from "@/lib/jobs/import";
import { triggerImageGenerationJob } from "@/lib/jobs/image-gen";
import { productFormSchema } from "@/lib/validation/product";
import { variantFormSchema } from "@/lib/validation/variant";
import type {
  AiSuggestion,
  ProductDescriptionSuggestion,
} from "@/lib/validation/ai-suggestion";
import { sanitizeDescriptionHtml } from "@/lib/sanitize-description";
import type { Collection } from "@/types/collection";
import type { BulkAiGenerationResult, BulkAiReviewItem } from "@/types/bulk-ai";
import type { Job, JobStatus } from "@/types/job";

const variantsFieldSchema = z.array(
  variantFormSchema.extend({ id: z.string().min(1) }),
);

const tagsFieldSchema = z
  .array(z.string().trim().min(1))
  .max(20, "No more than 20 tags");

const productStatusSchema = z.enum(["DRAFT", "ACTIVE"]);

const idSchema = z.string().trim().min(1, "Missing id.");
const idsSchema = z.array(idSchema);

const csvExportFiltersSchema = z.object({
  search: z.string().trim().max(200).default(""),
  statusFilter: z.enum(["all", "DRAFT", "ACTIVE", "CONFLICT"]).default("all"),
  categoryFilter: z.string().trim().max(200).default("all"),
});
const bulkAiReviewItemSchema = z.object({
  productId: idSchema,
  title: z.string(),
  imageUrl: z.string().nullable(),
  imageUrls: z.array(z.string()),
  seoTitle: z.string().trim(),
  seoDescription: z.string().trim(),
  tags: tagsFieldSchema,
  collectionId: z.string().trim().nullable(),
  collectionTitle: z.string().trim().nullable(),
  categoryId: z.string().trim().nullable(),
  categoryFullName: z.string().trim().nullable(),
}) satisfies z.ZodType<BulkAiReviewItem>;
const bulkAiReviewItemsSchema = z
  .array(bulkAiReviewItemSchema)
  .min(1, "Select at least one suggestion.");

// Validate resolveConflictWithSelections' `selections` param: each field
// must be explicitly "app" or "shopify". A real schema makes the actual
// constraint explicit instead of relying on ternary fallback behavior.
const conflictSideSchema = z.enum(["app", "shopify"]);
const conflictFieldSelectionsSchema = z.object({
  title: conflictSideSchema,
  description: conflictSideSchema,
  price: conflictSideSchema,
  status: conflictSideSchema,
  tags: conflictSideSchema,
  collection: conflictSideSchema,
  category: conflictSideSchema,
  seoTitle: conflictSideSchema,
  seoDescription: conflictSideSchema,
  variants: conflictSideSchema,
}) satisfies z.ZodType<ConflictFieldSelections>;

// Deletes from the app's own database only — there is no Shopify delete
// mutation yet (lib/shopify/products.ts only reads). If the product still
// exists on Shopify, a future sync would simply re-import it. Used for both
// a single product and a bulk selection from the product list.
export async function deleteProducts(
  productIds: string[],
): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idsSchema.safeParse(productIds).success) {
    return { error: "Invalid product selection." };
  }

  const { deletedCount } = await deleteProductsFromDb({
    accountId: account.id,
    productIds,
  });
  if (deletedCount === 0) {
    return { error: "Those products were already removed." };
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
}

// Creates a new local-only draft from an existing product. The
// database helper owns the copy/reset rules; this action only authenticates,
// validates, calls it, and refreshes the product views.
export async function duplicateProduct(
  productId: string,
): Promise<{ productId: string } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(productId).success) {
    return { error: "Invalid product." };
  }

  const product = await duplicateProductInDb({
    accountId: account.id,
    productId,
  });
  if (!product) {
    return { error: "This product no longer exists." };
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { productId: product.id };
}

export type ProductFormState =
  | {
      error?: string;
      fieldErrors?: Partial<
        Record<"title" | "description" | "price" | "status", string>
      >;
    }
  | { success: true }
  | undefined;

type ProductFieldErrors = Partial<
  Record<"title" | "description" | "price" | "status", string>
>;

function parseProductForm(
  formData: FormData,
):
  | { fieldErrors: ProductFieldErrors }
  | ReturnType<typeof productFormSchema.parse> {
  const metafieldsRaw = formData.get("metafields");
  let metafieldsInput: unknown = undefined;
  if (typeof metafieldsRaw === "string" && metafieldsRaw.length > 0) {
    try {
      metafieldsInput = JSON.parse(metafieldsRaw);
    } catch {
      metafieldsInput = undefined;
    }
  }

  const parsed = productFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    price: formData.get("price"),
    status: formData.get("status"),
    collectionId: formData.get("collectionId") ?? undefined,
    collectionTitle: formData.get("collectionTitle") ?? undefined,
    categoryId: formData.get("categoryId") ?? undefined,
    categoryFullName: formData.get("categoryFullName") ?? undefined,
    seoTitle: formData.get("seoTitle") ?? undefined,
    seoDescription: formData.get("seoDescription") ?? undefined,
    metafields: metafieldsInput,
  });

  if (!parsed.success) {
    const fieldErrors: ProductFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as
        | "title"
        | "description"
        | "price"
        | "status"
        | undefined;
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { fieldErrors };
  }

  return parsed.data;
}

// Creates a brand-new local-only draft product (shopifyProductId
// stays null until pushed to Shopify). storeId is bound via
// createProduct.bind(null, storeId) from the client form since it isn't
// part of the form's own fields.
export async function createProduct(
  storeId: string,
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(storeId).success) {
    return { error: "Invalid store." };
  }

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

// Edits a product's core fields. productId is bound via
// updateProduct.bind(null, productId) from the client form.
//
// Variants are staged client-side and only reach the database here,
// alongside the product's own fields — reconciled in one call to
// syncProductVariants rather than separate immediate-persist actions,
// so nothing about a variant saves until this button is pressed,
// same as title/price/status/description.
export async function updateProduct(
  productId: string,
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(productId).success) {
    return { error: "Invalid product." };
  }

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
      return {
        error:
          parsedVariants.error.issues[0]?.message ??
          "One or more variants are invalid.",
      };
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
      return {
        error:
          parsedTags.error.issues[0]?.message ??
          "One or more tags are invalid.",
      };
    }
    tagsInput = parsedTags.data;
  }

  const result = await updateProductInDb({
    accountId: account.id,
    productId,
    title: parsed.title,
    description: sanitizeDescriptionHtml(parsed.description),
    price: parsed.price,
    status: parsed.status,
    collectionId: parsed.collectionId || null,
    collectionTitle: parsed.collectionTitle || null,
    categoryId: parsed.categoryId || null,
    categoryFullName: parsed.categoryFullName || null,
    tags: tagsInput,
    seoTitle: parsed.seoTitle || null,
    seoDescription: parsed.seoDescription || null,
    metafields: parsed.metafields,
  });
  if (!result.success) {
    return {
      error:
        result.reason === "conflicted"
          ? "This product has an unresolved sync conflict. Resolve it before saving."
          : "This product no longer exists.",
    };
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
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Uploads a draft-state image to Vercel Blob and adds it to the
// product's gallery. Unlike title/price/status/variants, this is an
// immediate action, not staged behind the main Save button — an upload has
// to actually complete against Blob before there's a URL to show at all, so
// there's nothing meaningful to "stage" client-side the way a plain text
// edit can be.
export async function uploadProductImage(
  productId: string,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(productId).success) {
    return { error: "Invalid product." };
  }

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

  const product = await addProductImageInDb({
    accountId: account.id,
    productId,
    url: uploaded.url,
  });
  if (!product) {
    return { error: "This product no longer exists." };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}

export async function addProductImageUrlAction(
  productId: string,
  url: string,
): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(productId).success || !url) {
    return { error: "Invalid request." };
  }

  const product = await addProductImageInDb({
    accountId: account.id,
    productId,
    url,
  });
  if (!product) {
    return { error: "This product no longer exists." };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}

// Removes one image from the gallery — a draft Blob upload gets
// actually deleted from storage; a Shopify-imported image is just removed
// from the list (there's nothing in Blob to delete for it, and this never
// touches Shopify itself).
export async function removeProductImage(
  productId: string,
  url: string,
): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (
    !idSchema.safeParse(productId).success ||
    !idSchema.safeParse(url).success
  ) {
    return { error: "Invalid request." };
  }

  if (isBlobUrl(url)) {
    const deleted = await deleteProductImageFromBlob(url);
    if (!deleted.success) {
      return { error: deleted.error };
    }
  }

  const product = await removeProductImageInDb({
    accountId: account.id,
    productId,
    url,
  });
  if (!product) {
    return { error: "This product no longer exists." };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}

// Fetches an AI suggestion for a product's SEO title/description,
// tags, and collection. Deliberately does NOT persist anything or call
// revalidatePath — per architecture.md invariant 7, AI-generated content is
// only ever returned as a suggestion; it's written to the product record
// the same way any other edit is, only when the owner presses Save.
//
// Shopify Product Category: the model's structured output only
// ever contains a plain-text categoryGuess (lib/ai/suggestions.ts) — it's
// never shown Shopify's real ~10,000-category taxonomy. That guess is
// resolved into a real category here, server-side, by searching the actual
// taxonomy and taking the top match. This resolution step is best-effort:
// a search failure or zero results just means no category is suggested,
// never a failed SEO suggestion overall (same "fails open" convention
// app/(dashboard)/products/[id]/page.tsx already uses for collections).
export async function suggestProductSeo(productId: string): Promise<
  | {
      success: true;
      data: AiSuggestion & {
        categoryId: string | null;
        categoryFullName: string | null;
      };
    }
  | { error: string }
> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(productId).success) {
    return { error: "Invalid product." };
  }

  const product = await getProductById(account.id, productId);
  if (!product) {
    return { error: "This product no longer exists." };
  }

  // Same fetch sequence as app/(dashboard)/products/[id]/page.tsx — fails
  // open to an empty list rather than blocking the suggestion entirely.
  let collections: Collection[] = [];
  const storeToken = await getStoreToken(account.id, product.storeId);
  let accessToken: string | null = null;
  if (storeToken) {
    accessToken = decryptAccessToken(storeToken.accessTokenEncrypted);
    const result = await fetchAllCollections(
      storeToken.shopifyDomain,
      accessToken,
    );
    if (result.success) {
      collections = result.data;
    }
  }

  const storeAiRules = await getAiRulesForStore(account.id, product.storeId);
  const suggestion = await generateProductSuggestion({
    title: product.title,
    description: product.description,
    price: product.price,
    tags: product.tags,
    collections,
    rules: storeAiRules,
  });
  if (!suggestion.success) {
    return { error: suggestion.error };
  }

  let categoryId: string | null = null;
  let categoryFullName: string | null = null;
  if (suggestion.data.categoryGuess && storeToken && accessToken) {
    const categoryResult = await searchTaxonomyCategories(
      storeToken.shopifyDomain,
      accessToken,
      suggestion.data.categoryGuess,
      1,
    );
    if (categoryResult.success && categoryResult.data[0]) {
      categoryId = categoryResult.data[0].id;
      categoryFullName = categoryResult.data[0].fullName;
    }
  }

  return {
    success: true,
    data: { ...suggestion.data, categoryId, categoryFullName },
  };
}

// Generates suggestions sequentially through the existing
// single-product AI path. Generation returns review data only; no product is
// written until applyBulkAiSuggestions below receives the owner's explicit
// acceptance from the bulk-review dialog.
export async function generateBulkProductSeoSuggestions(
  productIds: string[],
): Promise<
  { success: true; data: BulkAiGenerationResult } | { error: string }
> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (productIds.length === 0 || !idsSchema.safeParse(productIds).success) {
    return { error: "Select at least one product." };
  }

  const products = await getProductsByIds(account.id, productIds);
  if (products.length === 0) {
    return { error: "Those products no longer exist." };
  }
  const storeId = products[0]!.storeId;
  if (products.some((product) => product.storeId !== storeId)) {
    return {
      error: "Bulk suggestions can only be generated for one store at a time.",
    };
  }

  let collections: Collection[] = [];
  const storeToken = await getStoreToken(account.id, storeId);
  if (storeToken) {
    const accessToken = decryptAccessToken(storeToken.accessTokenEncrypted);
    const collectionResult = await fetchAllCollections(
      storeToken.shopifyDomain,
      accessToken,
    );
    if (collectionResult.success) collections = collectionResult.data;
  }

  const suggestions: BulkAiReviewItem[] = [];
  const failures: BulkAiGenerationResult["failures"] = [];
  for (const product of products) {
    const result = await suggestProductSeo(product.id);
    if ("error" in result) {
      failures.push({
        productId: product.id,
        title: product.title,
        error: result.error,
      });
      continue;
    }
    const collection = collections.find(
      (entry) => entry.id === result.data.collectionId,
    );
    suggestions.push({
      productId: product.id,
      title: product.title,
      imageUrl: product.imageUrl,
      imageUrls: product.imageUrls,
      seoTitle: result.data.seoTitle,
      seoDescription: result.data.seoDescription,
      tags: result.data.tags,
      collectionId: result.data.collectionId,
      collectionTitle: collection?.title ?? null,
      categoryId: result.data.categoryId,
      categoryFullName: result.data.categoryFullName,
    });
  }

  if (suggestions.length === 0) {
    return {
      error: failures[0]?.error ?? "AI suggestions could not be generated.",
    };
  }

  return {
    success: true,
    data: { storeId, collections, suggestions, failures },
  };
}

export async function applyBulkAiSuggestions(
  suggestions: BulkAiReviewItem[],
): Promise<{ updatedCount: number } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const parsed = bulkAiReviewItemsSchema.safeParse(suggestions);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid suggestions." };
  }

  const { updatedCount } = await applyBulkAiSuggestionsInDb({
    accountId: account.id,
    suggestions: parsed.data,
  });
  if (updatedCount === 0) {
    return {
      error:
        "No suggestions could be saved. Resolve any product conflicts and try again.",
    };
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { updatedCount };
}

// New (Shopify Product Category unit): backs the product editor's manual
// category combobox — a live search against Shopify's real taxonomy, since
// (unlike the small pre-fetched collections list above) the full taxonomy
// is far too large to load wholesale. storeId-scoped rather than
// productId-scoped since the category field only ever appears in edit mode,
// where the caller already has the product's storeId on hand (same
// resolution getStoreToken already tenant-scopes by accountId+storeId).
export async function searchProductCategories(
  storeId: string,
  query: string,
): Promise<
  { success: true; data: ShopifyTaxonomyCategory[] } | { error: string }
> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(storeId).success) {
    return { error: "Invalid store." };
  }
  if (!query.trim()) {
    return { success: true, data: [] };
  }

  const storeToken = await getStoreToken(account.id, storeId);
  if (!storeToken) {
    return { error: "This store isn't connected to Shopify." };
  }

  const accessToken = decryptAccessToken(storeToken.accessTokenEncrypted);
  const result = await searchTaxonomyCategories(
    storeToken.shopifyDomain,
    accessToken,
    query.trim(),
  );
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true, data: result.data };
}

// Generates or improves a product description via AI. Deliberately
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
  storeId?: string;
}): Promise<
  { success: true; data: ProductDescriptionSuggestion } | { error: string }
> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!input.title.trim()) {
    return { error: "Enter a product title first." };
  }

  const storeAiRules = input.storeId
    ? await getAiRulesForStore(account.id, input.storeId)
    : undefined;

  const result = await generateProductDescriptionSuggestion({
    ...input,
    rules: storeAiRules,
  });
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true, data: result.data };
}

// Enqueues a push job — never calls Shopify itself (architecture.md
// invariants 4/5). The Job row is created here (not inside pushProductJob,
// unlike the import job's own pattern) so its id can be returned
// synchronously for the Push button's polling.
//
// Conflict check: components/product-form.tsx already disables the
// Republish button while `product.isConflicted` is true, and this
// single-product path enforces that server-side to ensure un-resolved
// conflicting products cannot be pushed.
export async function pushProduct(
  productId: string,
): Promise<{ jobId: string } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(productId).success) {
    return { error: "Invalid product." };
  }

  const product = await getProductById(account.id, productId);
  if (!product) {
    return { error: "This product no longer exists." };
  }
  if (product.isConflicted) {
    return {
      error:
        "This product has an unresolved sync conflict. Resolve it before pushing.",
    };
  }

  const job = await createJob({
    accountId: account.id,
    storeId: product.storeId,
    type: "PUSH",
  });
  await triggerProductPush({
    accountId: account.id,
    storeId: product.storeId,
    productId,
    jobId: job.id,
  });

  return { jobId: job.id };
}

// Mirrors pushProduct's shape — never calls Shopify itself
// (architecture.md invariant 4). Operates on a caller-supplied selection
// (components/product-table.tsx's existing row-selection UI), not an
// implicit "every unsynced product" filter, per explicit product decision.
// Eligibility: whether a product has
// ever reached Shopify (shopifyProductId === null) — NOT its local DRAFT/
// ACTIVE status, which is independent. A product that's locally DRAFT but
// was already pushed once is not re-pushed here, since that would silently
// overwrite whatever's currently live; republishing an already-synced
// product stays the single-product editor's explicit Republish button. The
// account-scoped eligibility check is defense in depth: the client already
// pre-filters its selection, but state could theoretically change between
// page load and click.
export async function pushSelectedProducts(
  productIds: string[],
): Promise<{ jobId: string; count: number } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (productIds.length === 0) {
    return { error: "No products selected." };
  }
  if (!idsSchema.safeParse(productIds).success) {
    return { error: "Invalid product selection." };
  }

  const eligible = await getEligibleUnsyncedProducts(account.id, productIds);
  if (eligible.length === 0) {
    return {
      error:
        "None of the selected products are new — they've already been pushed to Shopify.",
    };
  }

  const storeId = eligible[0].storeId;
  const eligibleIds = eligible.map((product) => product.id);

  const job = await createJob({ accountId: account.id, storeId, type: "PUSH" });
  await triggerBatchPush({
    accountId: account.id,
    storeId,
    jobId: job.id,
    productIds: eligibleIds,
  });

  return { jobId: job.id, count: eligibleIds.length };
}

// Resolves the active store the same way every server entry point
// does — reads the active-store-id cookie (set by
// app/(dashboard)/stores/actions.ts's setActiveStore) and validates it
// against this account's actual stores via getActiveStoreForAccount, falling
// back to the first connected store if the cookie is unset/stale/tampered.
async function resolveActiveStore(accountId: string) {
  const stores = await getStoresForAccount(accountId);
  const cookieStoreId =
    (await cookies()).get(ACTIVE_STORE_COOKIE_NAME)?.value ?? null;
  return getActiveStoreForAccount(stores, cookieStoreId);
}

// The no-selection counterpart to pushSelectedProducts —
// pushes every product for the active store that's never reached Shopify.
// Zero eligible products is a typed error, not a job — nothing to enqueue.
export async function pushAllDrafts(): Promise<
  { jobId: string; count: number } | { error: string }
> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const store = await resolveActiveStore(account.id);
  if (!store) {
    return { error: "Connect a store first." };
  }

  if (!store.connectedAt || !store.shopifyDomain) {
    return { error: "This store is not connected to Shopify. Connect it in Settings." };
  }

  const productIds = await getUnsyncedProductIdsForStore(account.id, store.id);
  if (productIds.length === 0) {
    return { error: "Every product has already been pushed to Shopify." };
  }

  const job = await createJob({
    accountId: account.id,
    storeId: store.id,
    type: "PUSH",
  });
  await triggerBatchPush({
    accountId: account.id,
    storeId: store.id,
    jobId: job.id,
    productIds,
  });

  return { jobId: job.id, count: productIds.length };
}

// The "Sync Store" trigger — pulls the store's current Shopify
// catalog into the database. A product with an unpushed local edit
// (lastEditedAt after lastSyncedAt) is flagged as a conflict.
// Store scope resolves the active store, same
// as pushAllDrafts above. Creates the Job row itself, same as every other
// dashboard-button-triggered job, so the button can poll it (invariant 4:
// never calls Shopify here, only enqueues).
export async function syncStore(): Promise<
  { jobId: string } | { error: string }
> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const store = await resolveActiveStore(account.id);
  if (!store) {
    return { error: "Connect a store first." };
  }

  if (!store.connectedAt || !store.shopifyDomain) {
    return { error: "This store is not connected to Shopify. Connect it in Settings." };
  }

  const tokenRecord = await getStoreToken(account.id, store.id);
  if (!tokenRecord || !tokenRecord.accessTokenEncrypted) {
    return { error: "This store is not connected to Shopify. Connect it in Settings." };
  }

  const job = await createJob({
    accountId: account.id,
    storeId: store.id,
    type: "SYNC",
  });
  try {
    await triggerStoreSync({
      accountId: account.id,
      storeId: store.id,
      shopifyDomain: store.shopifyDomain,
      jobId: job.id,
    });
  } catch (error) {
    // The local Inngest Dev Server (or the production queue) can be
    // unavailable before the event is accepted. Do not let that transport
    // failure escape the Server Action and crash the whole dashboard; record
    // the already-created Job as failed so it cannot remain PENDING forever.
    console.error(
      `syncStore: failed to enqueue job ${job.id} for store ${store.id}`,
      error,
    );
    const message =
      "Unable to start the sync. Check the job queue and try again.";
    await updateJobStatus({
      accountId: account.id,
      jobId: job.id,
      status: "FAILED",
      results: { error: message },
    });
    return { error: message };
  }

  return { jobId: job.id };
}

export type ProductPreviewItem = {
  id: string;
  shopifyProductId: string;
  title: string;
  status: "ACTIVE" | "DRAFT";
  imageUrl: string | null;
  categoryFullName: string | null;
  collectionTitle: string | null;
  existing: boolean;
};

export type ProductPreviewPage = {
  items: ProductPreviewItem[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

// Backs the selective product import modal (Agentify approach)
export async function previewShopifyProductsAction(input?: {
  query?: string;
  after?: string | null;
}): Promise<{ success: true; data: ProductPreviewPage } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const store = await resolveActiveStore(account.id);
  if (!store) {
    return { error: "Connect a store first." };
  }
  if (!store.connectedAt || !store.shopifyDomain) {
    return { error: "This store is not connected to Shopify. Connect it in Settings." };
  }

  const tokenRecord = await getStoreToken(account.id, store.id);
  if (!tokenRecord || !tokenRecord.accessTokenEncrypted) {
    return { error: "This store is not connected to Shopify. Connect it in Settings." };
  }

  const accessToken = decryptAccessToken(tokenRecord.accessTokenEncrypted);
  const preview = await previewShopifyProducts(
    store.shopifyDomain,
    accessToken,
    input?.query,
    input?.after,
  );

  if (!preview.success) {
    return { error: preview.error };
  }

  const bareIds = preview.data.items.map((item) => item.shopifyProductId);
  const existingSet = await getExistingShopifyProductIds(account.id, store.id, bareIds);

  const items: ProductPreviewItem[] = preview.data.items.map((item) => ({
    ...item,
    existing: existingSet.has(item.shopifyProductId),
  }));

  return {
    success: true,
    data: {
      items,
      pageInfo: preview.data.pageInfo,
    },
  };
}

// Enqueues a sync job for only the user-selected Shopify product IDs
export async function syncSelectedShopifyProductsAction(
  selectedProductIds: string[],
): Promise<{ jobId: string } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!selectedProductIds || selectedProductIds.length === 0) {
    return { error: "Select at least one product to sync." };
  }
  if (selectedProductIds.length > 100) {
    return { error: "You can select up to 100 products at a time." };
  }

  const store = await resolveActiveStore(account.id);
  if (!store) {
    return { error: "Connect a store first." };
  }
  if (!store.connectedAt || !store.shopifyDomain) {
    return { error: "This store is not connected to Shopify. Connect it in Settings." };
  }

  const tokenRecord = await getStoreToken(account.id, store.id);
  if (!tokenRecord || !tokenRecord.accessTokenEncrypted) {
    return { error: "This store is not connected to Shopify. Connect it in Settings." };
  }

  const job = await createJob({
    accountId: account.id,
    storeId: store.id,
    type: "SYNC",
  });

  try {
    await triggerStoreSync({
      accountId: account.id,
      storeId: store.id,
      shopifyDomain: store.shopifyDomain,
      jobId: job.id,
      productIds: selectedProductIds,
    });
  } catch (error) {
    console.error(`syncSelectedShopifyProductsAction: failed to enqueue job ${job.id}`, error);
    const message = "Unable to start the sync. Check the job queue and try again.";
    await updateJobStatus({
      accountId: account.id,
      jobId: job.id,
      status: "FAILED",
      results: { error: message },
    });
    return { error: message };
  }

  return { jobId: job.id };
}


// Changes one or more products' status directly from the
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
  syncToShopify: boolean,
): Promise<{ jobId?: string; count: number } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (productIds.length === 0) {
    return { error: "No products selected." };
  }
  if (!idsSchema.safeParse(productIds).success) {
    return { error: "Invalid product selection." };
  }
  if (!productStatusSchema.safeParse(status).success) {
    return { error: "Invalid status." };
  }

  const { updatedCount } = await updateProductsStatusInDb({
    accountId: account.id,
    productIds,
    status,
  });
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
  await triggerBatchPush({
    accountId: account.id,
    storeId,
    jobId: job.id,
    productIds: eligibleIds,
  });

  return { jobId: job.id, count: eligibleIds.length };
}

// Destructive action distinct from deleteProducts (above), which only
// ever touches Dockit's own database — this permanently removes the product from
// Shopify too. Gated client-side by
// components/delete-from-shopify-dialog.tsx's type-the-product-name
// confirmation before this is ever called. Never calls Shopify itself here
// (invariant 4) — just enqueues the job, same shape as pushProduct.
export async function deleteProductEverywhere(
  productId: string,
): Promise<{ jobId: string } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(productId).success) {
    return { error: "Invalid product." };
  }

  const product = await getProductById(account.id, productId);
  if (!product) {
    return { error: "This product no longer exists." };
  }
  if (!product.shopifyProductId) {
    return { error: "This product was never pushed to Shopify." };
  }

  const job = await createJob({
    accountId: account.id,
    storeId: product.storeId,
    type: "DELETE",
  });
  await triggerProductDelete({
    accountId: account.id,
    storeId: product.storeId,
    productId,
    jobId: job.id,
  });

  return { jobId: job.id };
}

// Per-field conflict resolution: replaces keeping either side in bulk
// with granular choices per field (all-"shopify" needs no push at all,
// invariant 1 stays satisfied; anything else does). Enqueues the push itself
// rather than making the dialog orchestrate two separate action calls.
export async function resolveConflictWithSelections(
  productId: string,
  selections: ConflictFieldSelections,
): Promise<{ jobId?: string } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const parsedSelections = conflictFieldSelectionsSchema.safeParse(selections);
  if (!idSchema.safeParse(productId).success || !parsedSelections.success) {
    return { error: "Invalid request." };
  }

  const result = await resolveConflictWithSelectionsInDb({
    accountId: account.id,
    productId,
    selections: parsedSelections.data,
  });
  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/dashboard");

  if (!result.needsPush) {
    return {};
  }

  const product = await getProductById(account.id, productId);
  if (!product) {
    return { error: "This product no longer exists." };
  }

  const job = await createJob({
    accountId: account.id,
    storeId: product.storeId,
    type: "PUSH",
  });
  await triggerProductPush({
    accountId: account.id,
    storeId: product.storeId,
    productId,
    jobId: job.id,
  });

  return { jobId: job.id };
}

// A plain polling read for the Push button's own inline status —
// no revalidatePath here, since nothing server-rendered changes per poll
// tick; the client refreshes itself once it observes SUCCEEDED. Generic by
// implementation despite the push-specific name — reused as-is by the
// delete job's polling too (renaming would touch every already-tested call
// site for no functional gain).
export async function getPushJobStatus(
  jobId: string,
): Promise<{ status: JobStatus; results: unknown } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(jobId).success) {
    return { error: "Job not found." };
  }

  const job = await getJobById(account.id, jobId);
  if (!job) {
    return { error: "Job not found." };
  }

  return { status: job.status, results: job.results };
}

// Backs the persistent job status indicator (components/job-status-indicator.tsx)
// — unlike getPushJobStatus above (poll a caller-known jobId until it
// settles), this discovers whatever the most recent job is on its own, so
// the indicator can show a job's status even when it wasn't the component
// that triggered it (e.g. after navigating to a different page mid-push).
// Same active-store resolution as pushAllDrafts/syncStore above. No store
// connected is a normal idle state (nothing to show), not an error.
export async function getLatestJobStatus(): Promise<
  { job: Job | null } | { error: string }
> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const store = await resolveActiveStore(account.id);
  if (!store) {
    return { job: null };
  }

  const job = await getLatestJobForStore(account.id, store.id);
  return { job };
}

// "Export CSV" on the product list — read-only, adds no new
// server-side state. Exports every product matching the
// current search/status/category filters across every page, not just the
// rows on the current page — reuses getPaginatedProductsForStore with
// pageSize: "all" (the same escape hatch the table's own "Rows per page"
// control already offers) rather than a new DB query, so filtering stays
// byte-for-byte consistent with what the table itself shows for the same
// filters. Same active-store resolution as every other dashboard-triggered
// action in this file.
export async function exportProductsCsv(filters: {
  search: string;
  statusFilter: "all" | "DRAFT" | "ACTIVE" | "CONFLICT";
  categoryFilter: string;
}): Promise<{ csv: string } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const parsed = csvExportFiltersSchema.safeParse(filters);
  if (!parsed.success) {
    return { error: "Invalid export filters." };
  }

  const store = await resolveActiveStore(account.id);
  if (!store) {
    return { error: "Connect a store first." };
  }

  const { products } = await getPaginatedProductsForStore(
    account.id,
    store.id,
    {
      pageSize: "all",
      search: parsed.data.search,
      statusFilter: parsed.data.statusFilter,
      categoryFilter: parsed.data.categoryFilter,
    },
  );

  return { csv: buildProductsCsv(products) };
}

export async function fetchCategoryAttributesAction(
  storeId: string,
  categoryId: string
): Promise<
  | { success: true; data: CategoryAttributeDefinition[] }
  | { success: false; error: string }
> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const storeToken = await getStoreToken(account.id, storeId);
  if (!storeToken) return { success: false, error: "Store not connected." };
  const accessToken = decryptAccessToken(storeToken.accessTokenEncrypted);
  const res = await fetchCategoryAttributes(storeToken.shopifyDomain, accessToken, categoryId);
  if (!res.success) return { success: false, error: res.error };
  return { success: true, data: res.data };
}

export async function fetchProductMetafieldDefinitionsAction(
  storeId: string
): Promise<
  | { success: true; data: ProductMetafieldDefinition[] }
  | { success: false; error: string }
> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const storeToken = await getStoreToken(account.id, storeId);
  if (!storeToken) return { success: false, error: "Store not connected." };
  const accessToken = decryptAccessToken(storeToken.accessTokenEncrypted);
  const res = await fetchProductMetafieldDefinitions(storeToken.shopifyDomain, accessToken);
  if (!res.success) return { success: false, error: res.error };
  return { success: true, data: res.data };
}

export async function startBulkProductImageGenerationAction(
  productIds: string[]
): Promise<{ success: true; jobIds: string[] } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  if (productIds.length === 0) return { error: "Select at least one product." };

  const products = await getProductsByIds(account.id, productIds);
  if (products.length === 0) return { error: "Selected products not found." };

  const jobIds: string[] = [];
  for (const product of products) {
    const referenceImage = product.imageUrl || product.imageUrls[0] || undefined;
    const job = await createJob({
      accountId: account.id,
      storeId: product.storeId,
      type: "GENERATE_IMAGE",
    });
    jobIds.push(job.id);
    await triggerImageGenerationJob({
      accountId: account.id,
      storeId: product.storeId,
      productId: product.id,
      jobId: job.id,
      prompt: `Professional high-end commercial studio product photography for ${product.title}, isolated clean lighting, crisp detail, 8k resolution`,
      referenceImageUrl: referenceImage,
      aspectRatio: "1:1",
      mode: "angle",
      count: 2,
    });
  }

  return { success: true, jobIds };
}

export async function enrichAndSaveSingleProductAction(
  productId: string,
  options?: { generateImages?: boolean },
): Promise<{ success: true } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(productId).success) {
    return { error: "Invalid product." };
  }

  const product = await getProductById(account.id, productId);
  if (!product) {
    return { error: "Product no longer exists." };
  }

  try {
    const candidateUrls =
      product.imageUrls && product.imageUrls.length > 0
        ? product.imageUrls
        : product.imageUrl
          ? [product.imageUrl]
          : [];

    let collections: Collection[] = [];
    let categoryAttributes: CategoryAttributeDefinition[] = [];
    let productMetafieldDefinitions: ProductMetafieldDefinition[] = [];

    const storeToken = await getStoreToken(account.id, product.storeId);
    if (storeToken) {
      const accessToken = decryptAccessToken(storeToken.accessTokenEncrypted);
      const [collectionsRes, metaDefsRes, catAttrsRes] = await Promise.all([
        fetchAllCollections(storeToken.shopifyDomain, accessToken),
        fetchProductMetafieldDefinitions(storeToken.shopifyDomain, accessToken),
        product.categoryId
          ? fetchCategoryAttributes(storeToken.shopifyDomain, accessToken, product.categoryId)
          : Promise.resolve({ success: true as const, data: [] }),
      ]);
      if (collectionsRes.success) collections = collectionsRes.data;
      if (metaDefsRes.success) productMetafieldDefinitions = metaDefsRes.data;
      if (catAttrsRes.success) categoryAttributes = catAttrsRes.data;
    }

    const storeAiRules = await getAiRulesForStore(account.id, product.storeId);
    const shouldGenerateImages = options?.generateImages ?? false;

    const result = await runFullProductAiVisionEnrichment({
      productId: product.id,
      title: product.title,
      price: product.price,
      description: product.description,
      imageUrls: candidateUrls,
      variants: product.variants,
      generateImages: shouldGenerateImages,
      rules: storeAiRules,
      collections,
      categoryAttributes,
      productMetafieldDefinitions,
    });

    const addImageUrls: string[] = [];
    if (shouldGenerateImages) {
      if (result.generatedImages) {
        addImageUrls.push(...result.generatedImages.map((img) => img.url));
      }
      if (result.generatedVariantImages) {
        addImageUrls.push(...result.generatedVariantImages.map((v) => v.url));
      }
    }

    const variantImages =
      shouldGenerateImages && result.generatedVariantImages
        ? result.generatedVariantImages.map((v) => ({
            variantId: v.variantId,
            imageUrl: v.url,
          }))
        : undefined;

    await applyFullAiEnrichmentInDb({
      accountId: account.id,
      productId: product.id,
      fields: {
        title: result.fields.title,
        description: result.fields.descriptionHtml,
        categoryId: result.fields.categoryId,
        categoryFullName: result.fields.categoryFullName,
        collectionId: result.fields.collectionId,
        collectionTitle: result.fields.collectionTitle,
        tags: result.fields.tags,
        seoTitle: result.fields.seoTitle,
        seoDescription: result.fields.seoDescription,
        metafields: result.fields.metafields,
      },
      addImageUrls,
      variantImages,
    });

    revalidatePath(`/products/${product.id}`);
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error(`Failed to enrich product ${product.id}:`, err);
    return { error: err instanceof Error ? err.message : "Failed to enrich product" };
  }
}

export async function generateBulkAiVisionEnrichmentAction(
  productIds: string[],
  options?: { generateImages?: boolean },
): Promise<
  | { success: true; enrichedCount: number; failureCount: number }
  | { error: string }
> {
  const { userId } = await auth.protect();
  await getOrCreateAccountForClerkUser(userId);
  if (productIds.length === 0 || !idsSchema.safeParse(productIds).success) {
    return { error: "Select at least one product." };
  }

  let enrichedCount = 0;
  let failureCount = 0;

  for (const productId of productIds) {
    const res = await enrichAndSaveSingleProductAction(productId, options);
    if ("success" in res) {
      enrichedCount++;
    } else {
      failureCount++;
    }
  }

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { success: true, enrichedCount, failureCount };
}



export async function generateFullAiProductEnrichmentAction(input: {
  productId: string;
  generateAlternativeImages?: boolean;
  textProvider?: TextVisionProviderName;
  imageProvider?: ImageProviderName;
}): Promise<
  | { success: true; data: FullAiVisionEnrichmentResult }
  | { error: string }
> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(input.productId).success) {
    return { error: "Invalid product." };
  }

  const product = await getProductById(account.id, input.productId);
  if (!product) {
    return { error: "This product no longer exists." };
  }

  try {
    const candidateUrls =
      product.imageUrls && product.imageUrls.length > 0
        ? product.imageUrls
        : product.imageUrl
          ? [product.imageUrl]
          : [];

    let collections: Collection[] = [];
    let categoryAttributes: CategoryAttributeDefinition[] = [];
    let productMetafieldDefinitions: ProductMetafieldDefinition[] = [];

    const storeToken = await getStoreToken(account.id, product.storeId);
    if (storeToken) {
      const accessToken = decryptAccessToken(storeToken.accessTokenEncrypted);
      const [collectionsRes, metaDefsRes, catAttrsRes] = await Promise.all([
        fetchAllCollections(storeToken.shopifyDomain, accessToken),
        fetchProductMetafieldDefinitions(storeToken.shopifyDomain, accessToken),
        product.categoryId
          ? fetchCategoryAttributes(storeToken.shopifyDomain, accessToken, product.categoryId)
          : Promise.resolve({ success: true as const, data: [] }),
      ]);
      if (collectionsRes.success) collections = collectionsRes.data;
      if (metaDefsRes.success) productMetafieldDefinitions = metaDefsRes.data;
      if (catAttrsRes.success) categoryAttributes = catAttrsRes.data;
    }

    const storeAiRules = await getAiRulesForStore(account.id, product.storeId);

    const result = await runFullProductAiVisionEnrichment({
      productId: product.id,
      title: product.title,
      price: product.price,
      description: product.description,
      imageUrls: candidateUrls,
      variants: product.variants,
      generateImages: input.generateAlternativeImages ?? true,
      textProvider: input.textProvider,
      imageProvider: input.imageProvider,
      rules: storeAiRules,
      collections,
      categoryAttributes,
      productMetafieldDefinitions,
    });

    return { success: true, data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI enrichment failed";
    return { error: message };
  }
}

export async function applyFullAiProductEnrichmentAction(input: {
  productId: string;
  fields: EnrichedProductFields;
  selectedImageUrls: string[];
  variantImages?: Array<{ variantId: string; imageUrl: string }>;
}): Promise<{ success: true } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(input.productId).success) {
    return { error: "Invalid product." };
  }

  const res = await applyFullAiEnrichmentInDb({
    accountId: account.id,
    productId: input.productId,
    fields: {
      title: input.fields.title,
      description: input.fields.descriptionHtml,
      categoryId: input.fields.categoryId,
      categoryFullName: input.fields.categoryFullName,
      collectionId: input.fields.collectionId,
      collectionTitle: input.fields.collectionTitle,
      tags: input.fields.tags,
      seoTitle: input.fields.seoTitle,
      seoDescription: input.fields.seoDescription,
      metafields: input.fields.metafields,
    },
    addImageUrls: input.selectedImageUrls,
    variantImages: input.variantImages,
  });

  if (!res.success) {
    if (res.reason === "conflicted") {
      return { error: "Cannot enrich a conflicted product. Resolve conflict first." };
    }
    return { error: "Product no longer exists." };
  }

  revalidatePath(`/products/${input.productId}`);
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function enqueueGenerateProductImagesAction(input: {
  productId: string;
  prompt: string;
  referenceImageUrl?: string | null;
  aspectRatio?: ImageAspectRatio;
  size?: string;
  mode?: ImageGenerationMode;
  provider?: ImageProviderName;
  count?: number;
}): Promise<{ success: true; jobId: string } | { error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(input.productId).success) {
    return { error: "Invalid product." };
  }

  const product = await getProductById(account.id, input.productId);
  if (!product) {
    return { error: "Product not found." };
  }

  try {
    const job = await createJob({
      accountId: account.id,
      storeId: product.storeId,
      type: "GENERATE_IMAGE",
    });

    await triggerImageGenerationJob({
      accountId: account.id,
      storeId: product.storeId,
      productId: product.id,
      jobId: job.id,
      prompt: input.prompt,
      referenceImageUrl: input.referenceImageUrl,
      aspectRatio: input.aspectRatio,
      size: input.size,
      mode: input.mode,
      provider: input.provider,
      count: input.count,
    });

    return { success: true, jobId: job.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to start image generation job.";
    return { error: message };
  }
}

