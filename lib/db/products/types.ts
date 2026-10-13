import type { ConflictSnapshot, Product } from "@/types/product";

export type ProductRecord = {
  id: string;
  storeId: string;
  shopifyProductId: string | null;
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
  isConflicted: boolean;
  conflictAppSnapshot: unknown;
  conflictShopifySnapshot: unknown;
  lastSyncedAt: Date | null;
  lastEditedAt?: Date;
  createdAt?: Date;
  variants: {
    id: string;
    shopifyVariantId: string | null;
    optionName: string;
    price: { toString(): string };
    inventory: number;
    imageUrl: string | null;
  }[];
};

export function toDomainProduct(product: ProductRecord): Product {
  return {
    id: product.id,
    storeId: product.storeId,
    shopifyProductId: product.shopifyProductId,
    title: product.title,
    description: product.description,
    imageUrl: product.imageUrl,
    imageUrls: product.imageUrls,
    price: product.price.toString(),
    status: product.status,
    tags: product.tags,
    collectionId: product.collectionId,
    collectionTitle: product.collectionTitle,
    categoryId: product.categoryId,
    categoryFullName: product.categoryFullName,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    isConflicted: product.isConflicted,
    conflictAppSnapshot:
      (product.conflictAppSnapshot as ConflictSnapshot | null) ?? null,
    conflictShopifySnapshot:
      (product.conflictShopifySnapshot as ConflictSnapshot | null) ?? null,
    lastSyncedAt: product.lastSyncedAt,
    lastEditedAt: product.lastEditedAt,
    createdAt: product.createdAt,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      shopifyVariantId: variant.shopifyVariantId,
      optionName: variant.optionName,
      price: variant.price.toString(),
      inventory: variant.inventory,
      imageUrl: variant.imageUrl,
    })),
  };
}

export type GetProductsOptions = {
  page?: number;
  pageSize?: number | "all";
  search?: string;
  statusFilter?: "all" | "DRAFT" | "ACTIVE" | "CONFLICT";
  categoryFilter?: string;
};

export type PaginatedProductsResult = {
  products: Product[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number | "all";
};

export type ProductSummary = {
  id: string;
  title: string;
  shopifyProductId: string | null;
  isConflicted: boolean;
};

export type ConflictFieldSelections = {
  title: "app" | "shopify";
  description: "app" | "shopify";
  price: "app" | "shopify";
  status: "app" | "shopify";
  tags: "app" | "shopify";
  collection: "app" | "shopify";
  category: "app" | "shopify";
  seoTitle: "app" | "shopify";
  seoDescription: "app" | "shopify";
  variants: "app" | "shopify";
};

export type BulkAiSuggestionItem = {
  productId: string;
  seoTitle?: string;
  seoDescription?: string;
  tags?: string[];
  collectionId?: string | null;
  collectionTitle?: string | null;
  categoryId?: string | null;
  categoryFullName?: string | null;
};
