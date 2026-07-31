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
  removeProductImage as removeProductImageInDb,
  updateProduct as updateProductInDb,
} from "@/lib/db/products";
import { syncProductVariants as syncProductVariantsInDb } from "@/lib/db/variants";
import {
  deleteProductImage as deleteProductImageFromBlob,
  isBlobUrl,
  uploadProductImage as uploadProductImageToBlob,
} from "@/lib/blob/products";
import { productFormSchema } from "@/lib/validation/product";
import { variantFormSchema } from "@/lib/validation/variant";
import { sanitizeDescriptionHtml } from "@/lib/sanitize-description";

// Matches the shape components/variant-list.tsx submits: id is either a
// real variant id or a client-generated temporary id for a not-yet-created
// row — lib/db/variants.ts's syncProductVariants tells them apart by
// checking against the product's actual current variant ids, not by
// inspecting the id's format here.
const variantsFieldSchema = z.array(variantFormSchema.extend({ id: z.string().min(1) }));

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

  const product = await updateProductInDb({
    accountId: account.id,
    productId,
    title: parsed.title,
    description: sanitizeDescriptionHtml(parsed.description),
    price: parsed.price,
    status: parsed.status,
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
