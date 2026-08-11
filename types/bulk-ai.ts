import type { Collection } from "@/types/collection";

export type BulkAiReviewItem = {
  productId: string;
  title: string;
  imageUrl: string | null;
  imageUrls: string[];
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  collectionId: string | null;
  collectionTitle: string | null;
  categoryId: string | null;
  categoryFullName: string | null;
};

export type BulkAiGenerationResult = {
  collections: Collection[];
  storeId: string;
  suggestions: BulkAiReviewItem[];
  failures: { productId: string; title: string; error: string }[];
};
