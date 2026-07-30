import { prisma } from "@/lib/db/client";
import type { ShopifyImportedProduct } from "@/lib/shopify/products";
import type { Product } from "@/types/product";

type ProductRecord = {
  id: string;
  storeId: string;
  shopifyProductId: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  price: { toString(): string };
  status: "DRAFT" | "ACTIVE";
  tags: string[];
  collectionId: string | null;
  collectionTitle: string | null;
  isConflicted: boolean;
  lastSyncedAt: Date | null;
  variants: {
    id: string;
    shopifyVariantId: string | null;
    optionName: string;
    price: { toString(): string };
    inventory: number;
  }[];
};

function toDomainProduct(product: ProductRecord): Product {
  return {
    id: product.id,
    storeId: product.storeId,
    shopifyProductId: product.shopifyProductId,
    title: product.title,
    description: product.description,
    imageUrl: product.imageUrl,
    price: product.price.toString(),
    status: product.status,
    tags: product.tags,
    collectionId: product.collectionId,
    collectionTitle: product.collectionTitle,
    isConflicted: product.isConflicted,
    lastSyncedAt: product.lastSyncedAt,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      shopifyVariantId: variant.shopifyVariantId,
      optionName: variant.optionName,
      price: variant.price.toString(),
      inventory: variant.inventory,
    })),
  };
}

// Read path for Unit 8's product list — accountId+storeId scoped per
// code-standards.md's tenant-isolation rule.
export async function getProductsForStore(accountId: string, storeId: string): Promise<Product[]> {
  const products = await prisma.product.findMany({
    where: { accountId, storeId },
    orderBy: { createdAt: "asc" },
    include: { variants: true },
  });
  return products.map(toDomainProduct);
}

// Read path for Unit 9's product editor — accountId-scoped (not also
// storeId-scoped, since a product id already uniquely identifies its store
// within the account; the editor doesn't need to know which store ahead of
// fetching). Returns null rather than throwing on a missing/foreign id, so
// the page can render a real 404 instead of an error boundary.
export async function getProductById(accountId: string, productId: string): Promise<Product | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, accountId },
    include: { variants: true },
  });
  return product ? toDomainProduct(product) : null;
}

// Account-scoped, app-database-only delete — does not touch Shopify (no
// delete mutation exists yet, see lib/shopify/products.ts). Used for both a
// single product (array of one) and bulk delete from the product list, so
// there's one code path instead of two. Variants cascade-delete via the
// schema's onDelete: Cascade.
export async function deleteProducts(input: {
  accountId: string;
  productIds: string[];
}): Promise<{ deletedCount: number }> {
  const result = await prisma.product.deleteMany({
    where: { id: { in: input.productIds }, accountId: input.accountId },
  });
  return { deletedCount: result.count };
}

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
        imageUrl: product.imageUrl,
        price: product.price,
        status: product.status,
        tags: product.tags,
        collectionId: product.collectionId,
        collectionTitle: product.collectionTitle,
        lastSyncedAt: now,
      },
      update: {
        title: product.title,
        description: product.description,
        imageUrl: product.imageUrl,
        price: product.price,
        status: product.status,
        tags: product.tags,
        collectionId: product.collectionId,
        collectionTitle: product.collectionTitle,
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
