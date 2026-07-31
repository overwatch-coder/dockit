import { del, put } from "@vercel/blob";

// Unit 12: draft-state product images live in Vercel Blob until a push
// replaces them with the Shopify CDN URL (context/architecture.md invariant
// 8) — this file is the only place that touches the Blob SDK directly, same
// isolation principle as lib/shopify/ for Shopify calls and lib/db/ for
// Prisma.
export async function uploadProductImage(input: {
  productId: string;
  file: File;
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    const blob = await put(`products/${input.productId}/${crypto.randomUUID()}-${input.file.name}`, input.file, {
      access: "public",
    });
    return { success: true, url: blob.url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Image upload failed: ${message}` };
  }
}

const BLOB_HOSTNAME_SUFFIX = ".public.blob.vercel-storage.com";

// Distinguishes a draft-state Blob URL from a published-state Shopify CDN
// URL, so removeProductImage never tries to del() a URL Blob doesn't own
// (a Shopify-imported gallery image, for example) — code-standards.md's
// rule that a product never references both at once for the *same* image
// still allows a product to have a mix of images from each source.
export function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(BLOB_HOSTNAME_SUFFIX);
  } catch {
    return false;
  }
}

export async function deleteProductImage(
  url: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await del(url);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Image delete failed: ${message}` };
  }
}
