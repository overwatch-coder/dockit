export type ProductStatus = "DRAFT" | "ACTIVE";

export type Variant = {
  id: string;
  shopifyVariantId: string | null;
  optionName: string;
  price: string;
  inventory: number;
  // Unit 25: one of the parent product's own imageUrls (or its single
  // legacy imageUrl, for products imported before the gallery field
  // existed), or null if this variant has no image of its own — falls back
  // to the product's default gallery display everywhere else in the app.
  imageUrl: string | null;
};

// Unit 18: the shape stored in Product.conflictAppSnapshot/conflictShopifySnapshot
// (Json columns) when a sync detects a conflict — one snapshot of the app's
// unpushed local state, one of the incoming Shopify state, both frozen at the
// moment the conflict was (re-)detected so Unit 19's resolution UI can diff
// them without re-fetching either side. Mirrors Product's own editable
// fields; deliberately excludes ids/timestamps, which aren't part of "what
// changed."
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
  isConflicted: boolean;
  // Unit 18: populated only while isConflicted is true; null once resolved
  // (Unit 19) or if the product has never conflicted.
  conflictAppSnapshot: ConflictSnapshot | null;
  conflictShopifySnapshot: ConflictSnapshot | null;
  variants: Variant[];
  lastSyncedAt: Date | null;
};
