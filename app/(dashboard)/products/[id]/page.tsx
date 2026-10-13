import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { getProductById } from "@/lib/db/products";
import { getStoreToken } from "@/lib/db/stores";
import { decryptAccessToken } from "@/lib/shopify/oauth";
import { fetchAllCollections } from "@/lib/shopify/collections";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/product-form";
import type { Collection } from "@/types/collection";

// Editable core fields (title, description, price, status) for a
// single product, saved via updateProduct (app/(dashboard)/products/actions.ts).
// Row click and the product list's Edit action both land here (components/product-table.tsx).
export default async function ProductEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const { id } = await params;

  const product = await getProductById(account.id, id);
  if (!product) {
    notFound();
  }

  // The store's Shopify collections, for the manual Collection
  // select — fetched live on every page load, not cached. Fails open: a fetch
  // error just means an empty list (the select falls back to "No collection"
  // plus whatever the product's existing collectionTitle already implies),
  // matching fetchShopName's existing "best-effort, never blocks the page" convention.
  let collections: Collection[] = [];
  const storeToken = await getStoreToken(account.id, product.storeId);
  if (storeToken) {
    const accessToken = decryptAccessToken(storeToken.accessTokenEncrypted);
    const result = await fetchAllCollections(storeToken.shopifyDomain, accessToken);
    if (result.success) {
      collections = result.data;
    }
  }

  let shopifyUrl: string | null = null;
  if (product.shopifyProductId && storeToken?.shopifyDomain) {
    const numericId = product.shopifyProductId.replace(/^gid:\/\/shopify\/Product\//, "");
    shopifyUrl = `https://${storeToken.shopifyDomain}/admin/products/${numericId}`;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-3.5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/products" />}>
          <ArrowLeft className="size-4" />
          Back to products
        </Button>

        {shopifyUrl && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={shopifyUrl} target="_blank" rel="noopener noreferrer" />}
          >
            Shopify
            <ExternalLink className="size-4" />
          </Button>
        )}
      </div>

      <h1 className="text-page-title font-semibold text-foreground">{product.title}</h1>

      <ProductForm mode="edit" product={product} collections={collections} />
    </div>
  );
}
