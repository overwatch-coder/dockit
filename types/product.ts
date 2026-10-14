export type ProductStatus = "DRAFT" | "ACTIVE";

export type Variant = {
  id: string;
  shopifyVariantId: string | null;
  optionName: string;
  price: string;
  inventory: number;
  // One of the parent product's own imageUrls (or its single legacy imageUrl,
  // for products imported before the gallery field existed), or null if this
  // variant has no image of its own — falls back to the product's default gallery.
  imageUrl: string | null;
  // Optional color swatch hex code (e.g. #000000, #3B82F6) synced to Shopify metafields
  colorHex?: string | null;
};

// The shape stored in Product.conflictAppSnapshot/conflictShopifySnapshot (Json columns)
// when a sync detects a conflict — one snapshot of the app's unpushed local state,
// one of the incoming Shopify state, both frozen at the moment the conflict was detected
// so resolution UI can diff them without re-fetching either side.
export type ConflictSnapshot = {
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  price: string;
  status: ProductStatus;
  tags: string[];
  collectionId: string | null;
  collectionTitle: string | null;
  categoryId: string | null;
  categoryFullName: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  variants: { shopifyVariantId: string | null; optionName: string; price: string; inventory: number }[];
};

export type MetafieldValueEntry = {
  namespace: string;
  key: string;
  name: string;
  value: string;
  type?: string;
  isCategoryMetafield?: boolean;
};

export type Product = {
  id: string;
  storeId: string;
  shopifyProductId: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  price: string;
  status: ProductStatus;
  tags: string[];
  collectionId: string | null;
  collectionTitle: string | null;
  categoryId: string | null;
  categoryFullName: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  metafields?: MetafieldValueEntry[];
  isConflicted: boolean;
  // Populated only while isConflicted is true; null once resolved
  // or if the product has never conflicted.
  conflictAppSnapshot: ConflictSnapshot | null;
  conflictShopifySnapshot: ConflictSnapshot | null;
  variants: Variant[];
  lastSyncedAt: Date | null;
  lastEditedAt?: Date;
  createdAt?: Date;
};
