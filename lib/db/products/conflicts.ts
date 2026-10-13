import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import type { ShopifyImportedProduct } from "@/lib/shopify/products";
import type { ConflictSnapshot } from "@/types/product";
import { toDomainProduct, type ConflictFieldSelections } from "./types";

export function shouldSkipSync(product: {
  lastEditedAt: Date;
  lastSyncedAt: Date | null;
}): boolean {
  if (!product.lastSyncedAt) return false;
  const diff = product.lastEditedAt.getTime() - product.lastSyncedAt.getTime();
  return diff > 1000;
}

export function valuesDiffer(a: string, b: string, numeric: boolean): boolean {
  if (!numeric) return a !== b;
  if (a.length === 0 || b.length === 0) return a !== b;
  const numA = Number(a);
  const numB = Number(b);
  if (Number.isNaN(numA) || Number.isNaN(numB)) return a !== b;
  return numA !== numB;
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/(p|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

export function hasConflictDifferences(
  app: ConflictSnapshot,
  shopify: ConflictSnapshot,
): boolean {
  if (app.title.trim() !== shopify.title.trim()) return true;
  if (
    htmlToPlainText(app.description ?? "") !==
    htmlToPlainText(shopify.description ?? "")
  )
    return true;
  if (valuesDiffer(app.price, shopify.price, true)) return true;
  if (app.status !== shopify.status) return true;
  if (app.tags.slice().sort().join(",") !== shopify.tags.slice().sort().join(","))
    return true;
  if (
    (app.collectionId ?? "") !== (shopify.collectionId ?? "") &&
    (app.collectionTitle ?? "") !== (shopify.collectionTitle ?? "")
  )
    return true;
  if (
    (app.categoryId ?? "") !== (shopify.categoryId ?? "") &&
    (app.categoryFullName ?? "") !== (shopify.categoryFullName ?? "")
  )
    return true;
  if ((app.seoTitle ?? "").trim() !== (shopify.seoTitle ?? "").trim()) return true;
  if ((app.seoDescription ?? "").trim() !== (shopify.seoDescription ?? "").trim())
    return true;

  if (app.variants.length !== shopify.variants.length) return true;
  for (const av of app.variants) {
    const sv =
      shopify.variants.find(
        (s) => s.shopifyVariantId && s.shopifyVariantId === av.shopifyVariantId,
      ) ?? shopify.variants.find((s) => s.optionName === av.optionName);
    if (!sv) return true;
    if (av.optionName.trim() !== sv.optionName.trim()) return true;
    if (valuesDiffer(av.price, sv.price, true)) return true;
    if (av.inventory !== sv.inventory) return true;
  }
  return false;
}

function toAppSnapshot(existing: {
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  price: { toString(): string };
  status: "DRAFT" | "ACTIVE";
  tags: string[];
  collectionId: string | null;
  collectionTitle: string | null;
  categoryId: string | null;
  categoryFullName: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  variants: {
    shopifyVariantId: string | null;
    optionName: string;
    price: { toString(): string };
    inventory: number;
  }[];
}): ConflictSnapshot {
  return {
    title: existing.title,
    description: existing.description,
    imageUrl: existing.imageUrl,
    imageUrls: existing.imageUrls,
    price: existing.price.toString(),
    status: existing.status,
    tags: existing.tags,
    collectionId: existing.collectionId,
    collectionTitle: existing.collectionTitle,
    categoryId: existing.categoryId,
    categoryFullName: existing.categoryFullName,
    seoTitle: existing.seoTitle,
    seoDescription: existing.seoDescription,
    variants: existing.variants.map((variant) => ({
      shopifyVariantId: variant.shopifyVariantId,
      optionName: variant.optionName,
      price: variant.price.toString(),
      inventory: variant.inventory,
    })),
  };
}

function toShopifySnapshot(product: ShopifyImportedProduct): ConflictSnapshot {
  return {
    title: product.title,
    description: product.description,
    imageUrl: product.imageUrl,
    imageUrls: product.imageUrls,
    price: product.price,
    status: product.status,
    tags: product.tags,
    collectionId: product.collectionId,
    collectionTitle: product.collectionTitle,
    categoryId: product.categoryId,
    categoryFullName: product.categoryFullName,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    variants: product.variants.map((variant) => ({
      shopifyVariantId: variant.shopifyVariantId,
      optionName: variant.optionName,
      price: variant.price,
      inventory: variant.inventory,
    })),
  };
}

export async function markProductPushed(input: {
  accountId: string;
  productId: string;
  shopifyProductId: string;
  imageUrl: string | null;
  imageUrls: string[];
  variants: { localVariantId: string; shopifyVariantId: string }[];
  variantImageUpdates?: { localVariantId: string; imageUrl: string }[];
}): Promise<{ updated: boolean }> {
  const existing = await prisma.product.findFirst({
    where: { id: input.productId, accountId: input.accountId },
  });
  if (!existing) {
    return { updated: false };
  }

  const variantUpdates = new Map<
    string,
    { shopifyVariantId?: string; imageUrl?: string }
  >();
  for (const variant of input.variants) {
    variantUpdates.set(variant.localVariantId, {
      ...variantUpdates.get(variant.localVariantId),
      shopifyVariantId: variant.shopifyVariantId,
    });
  }
  for (const variant of input.variantImageUpdates ?? []) {
    variantUpdates.set(variant.localVariantId, {
      ...variantUpdates.get(variant.localVariantId),
      imageUrl: variant.imageUrl,
    });
  }

  await prisma.$transaction([
    prisma.product.update({
      where: { id: input.productId },
      data: {
        shopifyProductId: input.shopifyProductId,
        imageUrl: input.imageUrl,
        imageUrls: input.imageUrls,
        lastSyncedAt: new Date(),
        isConflicted: false,
        conflictAppSnapshot: Prisma.JsonNull,
        conflictShopifySnapshot: Prisma.JsonNull,
      },
    }),
    ...[...variantUpdates.entries()].map(([localVariantId, data]) =>
      prisma.variant.update({ where: { id: localVariantId }, data }),
    ),
  ]);

  return { updated: true };
}

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
        imageUrls: product.imageUrls,
        price: product.price,
        status: product.status,
        tags: product.tags,
        collectionId: product.collectionId,
        collectionTitle: product.collectionTitle,
        categoryId: product.categoryId,
        categoryFullName: product.categoryFullName,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        lastSyncedAt: now,
        lastEditedAt: now,
        isConflicted: false,
        conflictAppSnapshot: Prisma.JsonNull,
        conflictShopifySnapshot: Prisma.JsonNull,
      },
      update: {
        title: product.title,
        description: product.description,
        imageUrl: product.imageUrl,
        imageUrls: product.imageUrls,
        price: product.price,
        status: product.status,
        tags: product.tags,
        collectionId: product.collectionId,
        collectionTitle: product.collectionTitle,
        categoryId: product.categoryId,
        categoryFullName: product.categoryFullName,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        lastSyncedAt: now,
        lastEditedAt: now,
        isConflicted: false,
        conflictAppSnapshot: Prisma.JsonNull,
        conflictShopifySnapshot: Prisma.JsonNull,
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

export async function syncProducts(input: {
  accountId: string;
  storeId: string;
  products: ShopifyImportedProduct[];
}): Promise<{
  syncedCount: number;
  conflictedCount: number;
  errorCount: number;
}> {
  const now = new Date();
  let syncedCount = 0;
  let conflictedCount = 0;
  let errorCount = 0;

  for (const product of input.products) {
    try {
      const existing = await prisma.product.findFirst({
        where: {
          accountId: input.accountId,
          storeId: input.storeId,
          shopifyProductId: product.shopifyProductId,
        },
        include: { variants: true },
      });

      if (existing && shouldSkipSync(existing)) {
        const appSnapshot = toAppSnapshot(existing);
        const shopifySnapshot = toShopifySnapshot(product);

        if (hasConflictDifferences(appSnapshot, shopifySnapshot)) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              isConflicted: true,
              conflictAppSnapshot: appSnapshot,
              conflictShopifySnapshot: shopifySnapshot,
            },
          });
          conflictedCount += 1;
          continue;
        }
      }

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
          imageUrls: product.imageUrls,
          price: product.price,
          status: product.status,
          tags: product.tags,
          collectionId: product.collectionId,
          collectionTitle: product.collectionTitle,
          categoryId: product.categoryId,
          categoryFullName: product.categoryFullName,
          seoTitle: product.seoTitle,
          seoDescription: product.seoDescription,
          lastSyncedAt: now,
          lastEditedAt: now,
          isConflicted: false,
          conflictAppSnapshot: Prisma.JsonNull,
          conflictShopifySnapshot: Prisma.JsonNull,
        },
        update: {
          title: product.title,
          description: product.description,
          imageUrl: product.imageUrl,
          imageUrls: product.imageUrls,
          price: product.price,
          status: product.status,
          tags: product.tags,
          collectionId: product.collectionId,
          collectionTitle: product.collectionTitle,
          categoryId: product.categoryId,
          categoryFullName: product.categoryFullName,
          seoTitle: product.seoTitle,
          seoDescription: product.seoDescription,
          lastSyncedAt: now,
          lastEditedAt: now,
          isConflicted: false,
          conflictAppSnapshot: Prisma.JsonNull,
          conflictShopifySnapshot: Prisma.JsonNull,
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

      syncedCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(
        `syncProducts: failed for shopifyProductId ${product.shopifyProductId}: ${message}`,
      );
      errorCount += 1;
    }
  }

  return { syncedCount, conflictedCount, errorCount };
}

export async function autoHealFalseConflicts(
  accountId: string,
  storeId: string,
): Promise<number> {
  const conflicted = await prisma.product.findMany({
    where: { accountId, storeId, isConflicted: true },
    include: { variants: true },
  });

  if (conflicted.length === 0) return 0;

  const now = new Date();
  let healed = 0;

  for (const prod of conflicted) {
    if (prod.conflictAppSnapshot && prod.conflictShopifySnapshot) {
      const app = prod.conflictAppSnapshot as unknown as ConflictSnapshot;
      const shopify = prod.conflictShopifySnapshot as unknown as ConflictSnapshot;

      if (!hasConflictDifferences(app, shopify)) {
        await prisma.product.update({
          where: { id: prod.id },
          data: {
            isConflicted: false,
            conflictAppSnapshot: Prisma.JsonNull,
            conflictShopifySnapshot: Prisma.JsonNull,
            lastSyncedAt: now,
            lastEditedAt: now,
          },
        });
        healed += 1;
      }
    } else {
      // Conflicted flag set but snapshot missing
      await prisma.product.update({
        where: { id: prod.id },
        data: {
          isConflicted: false,
          conflictAppSnapshot: Prisma.JsonNull,
          conflictShopifySnapshot: Prisma.JsonNull,
          lastSyncedAt: now,
          lastEditedAt: now,
        },
      });
      healed += 1;
    }
  }

  return healed;
}


export async function resolveConflictWithSelections(input: {
  accountId: string;
  productId: string;
  selections: ConflictFieldSelections;
}): Promise<
  { success: true; needsPush: boolean } | { success: false; error: string }
> {
  const existing = await prisma.product.findFirst({
    where: { id: input.productId, accountId: input.accountId },
    include: { variants: true },
  });
  if (!existing) {
    return { success: false, error: "This product no longer exists." };
  }
  if (!existing.isConflicted || !existing.conflictShopifySnapshot) {
    return {
      success: false,
      error: "This product has no conflict to resolve.",
    };
  }

  const shopifySnapshot =
    existing.conflictShopifySnapshot as unknown as ConflictSnapshot;
  const appSnapshot = toAppSnapshot(existing);
  const { selections } = input;
  const needsPush = Object.values(selections).some((side) => side === "app");
  const now = new Date();

  await prisma.$transaction([
    prisma.product.update({
      where: { id: existing.id },
      data: {
        title:
          selections.title === "app"
            ? appSnapshot.title
            : shopifySnapshot.title,
        description:
          selections.description === "app"
            ? appSnapshot.description
            : shopifySnapshot.description,
        price:
          selections.price === "app"
            ? appSnapshot.price
            : shopifySnapshot.price,
        status:
          selections.status === "app"
            ? appSnapshot.status
            : shopifySnapshot.status,
        tags:
          selections.tags === "app" ? appSnapshot.tags : shopifySnapshot.tags,
        collectionId:
          selections.collection === "app"
            ? appSnapshot.collectionId
            : shopifySnapshot.collectionId,
        collectionTitle:
          selections.collection === "app"
            ? appSnapshot.collectionTitle
            : shopifySnapshot.collectionTitle,
        categoryId:
          selections.category === "app"
            ? appSnapshot.categoryId
            : shopifySnapshot.categoryId,
        categoryFullName:
          selections.category === "app"
            ? appSnapshot.categoryFullName
            : shopifySnapshot.categoryFullName,
        seoTitle:
          selections.seoTitle === "app"
            ? appSnapshot.seoTitle
            : shopifySnapshot.seoTitle,
        seoDescription:
          selections.seoDescription === "app"
            ? appSnapshot.seoDescription
            : shopifySnapshot.seoDescription,
        ...(needsPush
          ? {}
          : {
              imageUrl: shopifySnapshot.imageUrl,
              imageUrls: shopifySnapshot.imageUrls,
            }),
        isConflicted: false,
        conflictAppSnapshot: Prisma.JsonNull,
        conflictShopifySnapshot: Prisma.JsonNull,
        ...(needsPush ? { lastEditedAt: now } : { lastSyncedAt: now }),
      },
    }),
    ...(selections.variants === "shopify"
      ? shopifySnapshot.variants
          .filter(
            (
              variant,
            ): variant is typeof variant & { shopifyVariantId: string } =>
              variant.shopifyVariantId !== null,
          )
          .map((variant) =>
            prisma.variant.upsert({
              where: {
                productId_shopifyVariantId: {
                  productId: existing.id,
                  shopifyVariantId: variant.shopifyVariantId,
                },
              },
              create: {
                accountId: input.accountId,
                productId: existing.id,
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
            }),
          )
      : []),
  ]);

  return { success: true, needsPush };
}

export async function applyBulkAiSuggestions(input: {
  accountId: string;
  suggestions: {
    productId: string;
    seoTitle: string;
    seoDescription: string;
    tags: string[];
    collectionId: string | null;
    collectionTitle: string | null;
    categoryId: string | null;
    categoryFullName: string | null;
  }[];
}): Promise<{ updatedCount: number }> {
  const results = await prisma.$transaction(
    input.suggestions.map((suggestion) =>
      prisma.product.updateMany({
        where: {
          id: suggestion.productId,
          accountId: input.accountId,
          isConflicted: false,
        },
        data: {
          seoTitle: suggestion.seoTitle || null,
          seoDescription: suggestion.seoDescription || null,
          tags: suggestion.tags,
          collectionId: suggestion.collectionId,
          collectionTitle: suggestion.collectionTitle,
          categoryId: suggestion.categoryId,
          categoryFullName: suggestion.categoryFullName,
          lastEditedAt: new Date(),
        },
      }),
    ),
  );
  return {
    updatedCount: results.reduce((count, result) => count + result.count, 0),
  };
}
