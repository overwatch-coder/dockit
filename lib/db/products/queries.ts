import { prisma } from "@/lib/db/client";
import type { Product } from "@/types/product";
import {
  toDomainProduct,
  type GetProductsOptions,
  type PaginatedProductsResult,
  type ProductSummary,
} from "./types";
import { autoHealFalseConflicts } from "./conflicts";

export async function getProductsForStore(
  accountId: string,
  storeId: string,
): Promise<Product[]> {
  try {
    await autoHealFalseConflicts(accountId, storeId);
  } catch (err) {
    console.error("autoHealFalseConflicts error:", err);
  }

  const products = await prisma.product.findMany({
    where: { accountId, storeId },
    orderBy: { createdAt: "desc" },
    include: { variants: true },
  });
  return products.map(toDomainProduct);
}

export async function getPaginatedProductsForStore(
  accountId: string,
  storeId: string,
  options: GetProductsOptions = {},
): Promise<PaginatedProductsResult> {
  try {
    await autoHealFalseConflicts(accountId, storeId);
  } catch (err) {
    console.error("autoHealFalseConflicts error:", err);
  }

  const where: {
    accountId: string;
    storeId: string;
    title?: { contains: string; mode: "insensitive" };
    isConflicted?: boolean;
    status?: "DRAFT" | "ACTIVE";
    collectionTitle?: string;
  } = {
    accountId,
    storeId,
  };

  if (options.search?.trim()) {
    where.title = { contains: options.search.trim(), mode: "insensitive" };
  }

  if (options.statusFilter === "CONFLICT") {
    where.isConflicted = true;
  } else if (options.statusFilter === "DRAFT") {
    where.status = "DRAFT";
    where.isConflicted = false;
  } else if (options.statusFilter === "ACTIVE") {
    where.status = "ACTIVE";
    where.isConflicted = false;
  }

  if (options.categoryFilter && options.categoryFilter !== "all") {
    where.collectionTitle = options.categoryFilter;
  }

  const requestedPage = Math.max(1, options.page ?? 1);
  const pageSizeOption = options.pageSize ?? 25;
  const take = pageSizeOption === "all" ? undefined : pageSizeOption;

  const { totalCount, totalPages, page, records } = await prisma.$transaction(
    async (tx) => {
      const totalCount = await tx.product.count({ where });
      const totalPages = take ? Math.max(1, Math.ceil(totalCount / take)) : 1;
      const page = Math.min(requestedPage, totalPages);
      const skip = take ? (page - 1) * take : undefined;

      const records = await tx.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { variants: true },
        skip,
        take,
      });

      return { totalCount, totalPages, page, records };
    },
  );

  return {
    products: records.map(toDomainProduct),
    totalCount,
    totalPages,
    page,
    pageSize: pageSizeOption,
  };
}

export async function getStoreCategories(
  accountId: string,
  storeId: string,
): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { accountId, storeId, collectionTitle: { not: null } },
    select: { collectionTitle: true },
    distinct: ["collectionTitle"],
  });
  return products.map((p) => p.collectionTitle!).filter(Boolean);
}

export async function getProductSummariesForStore(
  accountId: string,
  storeId: string,
): Promise<ProductSummary[]> {
  return prisma.product.findMany({
    where: { accountId, storeId },
    select: {
      id: true,
      title: true,
      shopifyProductId: true,
      isConflicted: true,
    },
  });
}

export async function getProductById(
  accountId: string,
  productId: string,
): Promise<Product | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, accountId },
    include: { variants: true },
  });
  return product ? toDomainProduct(product) : null;
}

export async function getProductsByIds(
  accountId: string,
  productIds: string[],
): Promise<Product[]> {
  const products = await prisma.product.findMany({
    where: { accountId, id: { in: productIds } },
    include: { variants: true },
  });
  return products.map(toDomainProduct);
}

export async function getEligibleUnsyncedProducts(
  accountId: string,
  productIds: string[],
): Promise<{ id: string; storeId: string }[]> {
  return prisma.product.findMany({
    where: {
      accountId,
      id: { in: productIds },
      shopifyProductId: null,
      isConflicted: false,
    },
    select: { id: true, storeId: true },
  });
}

export async function getUnsyncedProductIdsForStore(
  accountId: string,
  storeId: string,
): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { accountId, storeId, shopifyProductId: null, isConflicted: false },
    select: { id: true },
  });
  return products.map((product) => product.id);
}

export async function getProductsForStatusSync(
  accountId: string,
  productIds: string[],
): Promise<{ id: string; storeId: string }[]> {
  return prisma.product.findMany({
    where: { accountId, id: { in: productIds }, isConflicted: false },
    select: { id: true, storeId: true },
  });
}

export async function getExistingShopifyProductIds(
  accountId: string,
  storeId: string,
  shopifyProductIds: string[],
): Promise<Set<string>> {
  if (shopifyProductIds.length === 0) return new Set();
  const products = await prisma.product.findMany({
    where: {
      accountId,
      storeId,
      shopifyProductId: { in: shopifyProductIds },
    },
    select: { shopifyProductId: true },
  });
  return new Set(products.map((p) => p.shopifyProductId!).filter(Boolean));
}

export async function getProductSiblingNavigation(input: {
  accountId: string;
  storeId: string;
  productId: string;
  search?: string;
  statusFilter?: "all" | "DRAFT" | "ACTIVE" | "CONFLICT";
  categoryFilter?: string;
}): Promise<{
  prevProductId: string | null;
  nextProductId: string | null;
  currentIndex: number;
  totalCount: number;
}> {
  const where: {
    accountId: string;
    storeId: string;
    title?: { contains: string; mode: "insensitive" };
    isConflicted?: boolean;
    status?: "DRAFT" | "ACTIVE";
    collectionTitle?: string;
  } = {
    accountId: input.accountId,
    storeId: input.storeId,
  };

  if (input.search?.trim()) {
    where.title = { contains: input.search.trim(), mode: "insensitive" };
  }

  if (input.statusFilter === "CONFLICT") {
    where.isConflicted = true;
  } else if (input.statusFilter === "DRAFT") {
    where.status = "DRAFT";
    where.isConflicted = false;
  } else if (input.statusFilter === "ACTIVE") {
    where.status = "ACTIVE";
    where.isConflicted = false;
  }

  if (input.categoryFilter && input.categoryFilter !== "all") {
    where.collectionTitle = input.categoryFilter;
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const ids = products.map((p) => p.id);
  const index = ids.indexOf(input.productId);
  const totalCount = ids.length;
  const prevProductId = index > 0 ? ids[index - 1] : null;
  const nextProductId = index >= 0 && index < totalCount - 1 ? ids[index + 1] : null;

  return {
    prevProductId,
    nextProductId,
    currentIndex: index >= 0 ? index + 1 : 1,
    totalCount,
  };
}

