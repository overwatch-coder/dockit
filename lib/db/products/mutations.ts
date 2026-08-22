import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Product } from "@/types/product";
import type { CsvImportProductInput, CsvImportVariantInput } from "@/lib/csv/products";
import { toDomainProduct } from "./types";

export function duplicateProductTitle(title: string): string {
  return `${title.trim()} Copy`;
}

export async function duplicateProduct(input: {
  accountId: string;
  productId: string;
}): Promise<Product | null> {
  const source = await prisma.product.findFirst({
    where: { id: input.productId, accountId: input.accountId },
    include: { variants: true },
  });
  if (!source) {
    return null;
  }

  const product = await prisma.product.create({
    data: {
      accountId: input.accountId,
      storeId: source.storeId,
      shopifyProductId: null,
      title: duplicateProductTitle(source.title),
      description: source.description,
      imageUrl: source.imageUrl,
      imageUrls: source.imageUrls,
      price: source.price,
      status: "DRAFT",
      tags: source.tags,
      collectionId: source.collectionId,
      collectionTitle: source.collectionTitle,
      categoryId: source.categoryId,
      categoryFullName: source.categoryFullName,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      lastEditedAt: new Date(),
      lastSyncedAt: null,
      isConflicted: false,
      conflictAppSnapshot: Prisma.JsonNull,
      conflictShopifySnapshot: Prisma.JsonNull,
      variants: {
        create: source.variants.map((variant) => ({
          accountId: input.accountId,
          shopifyVariantId: null,
          optionName: variant.optionName,
          price: variant.price,
          inventory: variant.inventory,
          imageUrl: variant.imageUrl,
        })),
      },
    },
    include: { variants: true },
  });

  return toDomainProduct(product);
}

export async function createProduct(input: {
  accountId: string;
  storeId: string;
  title: string;
  description: string;
  price: string;
  status: "DRAFT" | "ACTIVE";
}): Promise<Product> {
  const product = await prisma.product.create({
    data: {
      accountId: input.accountId,
      storeId: input.storeId,
      shopifyProductId: null,
      title: input.title,
      description: input.description,
      price: input.price,
      status: input.status,
      lastEditedAt: new Date(),
    },
    include: { variants: true },
  });
  return toDomainProduct(product);
}

export async function updateProduct(input: {
  accountId: string;
  productId: string;
  title: string;
  description: string;
  price: string;
  status: "DRAFT" | "ACTIVE";
  collectionId?: string | null;
  collectionTitle?: string | null;
  categoryId?: string | null;
  categoryFullName?: string | null;
  tags?: string[];
  seoTitle?: string | null;
  seoDescription?: string | null;
}): Promise<
  | { success: true; product: Product }
  | { success: false; reason: "not-found" | "conflicted" }
> {
  const existing = await prisma.product.findFirst({
    where: { id: input.productId, accountId: input.accountId },
  });
  if (!existing) {
    return { success: false, reason: "not-found" };
  }
  if (existing.isConflicted) {
    return { success: false, reason: "conflicted" };
  }

  const product = await prisma.product.update({
    where: { id: input.productId },
    data: {
      title: input.title,
      description: input.description,
      price: input.price,
      status: input.status,
      collectionId: input.collectionId ?? null,
      collectionTitle: input.collectionTitle ?? null,
      categoryId: input.categoryId ?? null,
      categoryFullName: input.categoryFullName ?? null,
      tags: input.tags ?? [],
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      lastEditedAt: new Date(),
    },
    include: { variants: true },
  });
  return { success: true, product: toDomainProduct(product) };
}

export async function addProductImage(input: {
  accountId: string;
  productId: string;
  url: string;
}): Promise<Product | null> {
  const existing = await prisma.product.findFirst({
    where: { id: input.productId, accountId: input.accountId },
  });
  if (!existing) {
    return null;
  }

  const product = await prisma.product.update({
    where: { id: input.productId },
    data: {
      imageUrls: { push: input.url },
      imageUrl: existing.imageUrl ?? input.url,
      lastEditedAt: new Date(),
    },
    include: { variants: true },
  });
  return toDomainProduct(product);
}

export async function removeProductImage(input: {
  accountId: string;
  productId: string;
  url: string;
}): Promise<Product | null> {
  const existing = await prisma.product.findFirst({
    where: { id: input.productId, accountId: input.accountId },
  });
  if (!existing) {
    return null;
  }

  const nextImageUrls = existing.imageUrls.filter((url) => url !== input.url);
  const nextImageUrl =
    existing.imageUrl === input.url
      ? (nextImageUrls[0] ?? null)
      : existing.imageUrl;

  const product = await prisma.product.update({
    where: { id: input.productId },
    data: {
      imageUrls: nextImageUrls,
      imageUrl: nextImageUrl,
      lastEditedAt: new Date(),
    },
    include: { variants: true },
  });
  return toDomainProduct(product);
}

export async function updateProductsStatus(input: {
  accountId: string;
  productIds: string[];
  status: "DRAFT" | "ACTIVE";
}): Promise<{ updatedCount: number }> {
  const result = await prisma.product.updateMany({
    where: { id: { in: input.productIds }, accountId: input.accountId },
    data: { status: input.status, lastEditedAt: new Date() },
  });
  return { updatedCount: result.count };
}

export async function deleteProducts(input: {
  accountId: string;
  productIds: string[];
}): Promise<{ deletedCount: number }> {
  const result = await prisma.product.deleteMany({
    where: { id: { in: input.productIds }, accountId: input.accountId },
  });
  return { deletedCount: result.count };
}

export async function createImportedProducts(input: {
  accountId: string;
  storeId: string;
  products: CsvImportProductInput[];
}): Promise<Product[]> {
  const created: Product[] = [];

  for (const productInput of input.products) {
    const productRecord = await prisma.product.create({
      data: {
        accountId: input.accountId,
        storeId: input.storeId,
        shopifyProductId: null,
        title: productInput.title,
        description: productInput.description || "",
        price: productInput.price,
        status: productInput.status,
        collectionTitle: productInput.collectionTitle || null,
        tags: productInput.tags || [],
        lastEditedAt: new Date(),
        variants: {
          create:
            productInput.variants && productInput.variants.length > 0
              ? productInput.variants.map((v: CsvImportVariantInput) => ({
                  accountId: input.accountId,
                  shopifyVariantId: null,
                  optionName: v.optionName,
                  price: v.price,
                  inventory: v.inventory,
                }))
              : [],
        },
      },
      include: { variants: true },
    });
    created.push(toDomainProduct(productRecord));
  }

  return created;
}
