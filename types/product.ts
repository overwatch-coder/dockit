export type ProductStatus = "DRAFT" | "ACTIVE";

export type Variant = {
  id: string;
  shopifyVariantId: string | null;
  optionName: string;
  price: string;
  inventory: number;
};

export type Product = {
  id: string;
  storeId: string;
  shopifyProductId: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  status: ProductStatus;
  tags: string[];
  collectionId: string | null;
  collectionTitle: string | null;
  isConflicted: boolean;
  variants: Variant[];
  lastSyncedAt: Date | null;
};
