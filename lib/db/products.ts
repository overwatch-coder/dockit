import { prisma } from "@/lib/db/client";
import type { ShopifyImportedProduct } from "@/lib/shopify/products";

// Upserts each imported product keyed on the storeId+shopifyProductId
// compound unique (prisma/schema.prisma), so re-running the import (retries,
// or a future re-connect) is idempotent instead of duplicating rows. Variants
// are upserted the same way, keyed on productId+shopifyVariantId, as a
// separate pass once the product's id is known — nested compound-unique
// upserts under a parent upsert require the parent id at the type level
// before it exists, so this is clearer as two explicit steps. Only
// Shopify-sourced fields are touched — lastEditedAt and the draft/conflict
// fields belong to the app-side edit flow (Units 9/10, 18) and are left
// alone here.
export async function importProducts(input: {
  accountId: string;
  storeId: string;
  products: ShopifyImportedProduct[];
}): Promise<{ importedCount: number }> {
  const now = new Date();

  for (const product of input.products) {
    const savedProduct = await prisma.product.upsert({
      where: {
        storeId_shopifyProductId: {
          storeId: input.storeId,
          shopifyProductId: product.shopifyProductId,
        },
      },
      create: {
        accountId: input.accountId,
        storeId: input.storeId,
        shopifyProductId: product.shopifyProductId,
        title: product.title,
        description: product.description,
        price: product.price,
        status: product.status,
        tags: product.tags,
        lastSyncedAt: now,
      },
      update: {
        title: product.title,
        description: product.description,
        price: product.price,
        status: product.status,
        tags: product.tags,
        lastSyncedAt: now,
      },
    });

    for (const variant of product.variants) {
      await prisma.variant.upsert({
        where: {
          productId_shopifyVariantId: {
            productId: savedProduct.id,
            shopifyVariantId: variant.shopifyVariantId,
          },
        },
        create: {
          accountId: input.accountId,
          productId: savedProduct.id,
          shopifyVariantId: variant.shopifyVariantId,
          optionName: variant.optionName,
          price: variant.price,
          inventory: variant.inventory,
        },
        update: {
          optionName: variant.optionName,
          price: variant.price,
          inventory: variant.inventory,
        },
      });
    }
  }

  return { importedCount: input.products.length };
}
