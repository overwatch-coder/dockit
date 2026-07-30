"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import {
  createProduct as createProductInDb,
  deleteProducts as deleteProductsFromDb,
  updateProduct as updateProductInDb,
} from "@/lib/db/products";
import {
  addVariant as addVariantInDb,
  deleteVariant as deleteVariantInDb,
  updateVariant as updateVariantInDb,
} from "@/lib/db/variants";
import { productFormSchema } from "@/lib/validation/product";
import { variantFormSchema } from "@/lib/validation/variant";
import { sanitizeDescriptionHtml } from "@/lib/sanitize-description";

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

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

type VariantInput = { optionName: string; price: string; inventory: number };

// Unit 11: variant add/edit/remove, a child of the product draft. Plain
// callable actions (not tied to a <form>) since each variant row in
// components/variant-list.tsx is independently, inline-editable inside the
// product editor's own <form> — a nested <form> per row isn't valid HTML,
// same reasoning as disconnectStore's useTransition-based call.
export async function addVariant(
  productId: string,
  input: VariantInput
): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const parsed = variantFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid variant" };
  }

  const variant = await addVariantInDb({ accountId: account.id, productId, ...parsed.data });
  if (!variant) {
    return { error: "This product no longer exists." };
  }

  revalidatePath(`/products/${productId}`);
}

export async function updateVariant(
  variantId: string,
  input: VariantInput
): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const parsed = variantFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid variant" };
  }

  const result = await updateVariantInDb({ accountId: account.id, variantId, ...parsed.data });
  if (!result) {
    return { error: "This variant no longer exists." };
  }

  revalidatePath(`/products/${result.productId}`);
}

export async function deleteVariant(variantId: string): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const { deleted, productId } = await deleteVariantInDb({ accountId: account.id, variantId });
  if (!deleted) {
    return { error: "This variant was already removed." };
  }

  if (productId) {
    revalidatePath(`/products/${productId}`);
  }
}
