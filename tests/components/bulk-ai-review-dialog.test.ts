import { describe, expect, test } from "vitest";
import {
  collectionDisplayName,
  getAcceptedBulkAiSuggestions,
  getBulkReviewImageUrls,
} from "@/components/bulk-ai-review-dialog";
import type { BulkAiReviewItem } from "@/types/bulk-ai";

const suggestion = (productId: string): BulkAiReviewItem => ({
  productId,
  title: `Product ${productId}`,
  imageUrl: null,
  imageUrls: [],
  seoTitle: "SEO title",
  seoDescription: "SEO description",
  tags: ["tag"],
  collectionId: null,
  collectionTitle: null,
  categoryId: null,
  categoryFullName: null,
});

describe("getAcceptedBulkAiSuggestions", () => {
  test("only returns suggestions the owner explicitly included", () => {
    const result = getAcceptedBulkAiSuggestions([suggestion("one"), suggestion("two")], new Set(["two"]));

    expect(result.map((item) => item.productId)).toEqual(["two"]);
  });
});

describe("getBulkReviewImageUrls", () => {
  test("uses the featured image first and removes duplicate gallery URLs", () => {
    expect(
      getBulkReviewImageUrls({
        imageUrl: "https://cdn.shopify.com/featured.jpg",
        imageUrls: ["https://cdn.shopify.com/featured.jpg", "https://cdn.shopify.com/second.jpg", "https://cdn.shopify.com/third.jpg"],
      })
    ).toEqual(["https://cdn.shopify.com/featured.jpg", "https://cdn.shopify.com/second.jpg"]);
  });
});

describe("collectionDisplayName", () => {
  test("resolves a collection id to its owner-facing title", () => {
    expect(collectionDisplayName("299196743779", [{ id: "299196743779", title: "Spring Collection" }])).toBe(
      "Spring Collection"
    );
  });

  test("uses the no-collection label for an empty selection", () => {
    expect(collectionDisplayName("none", [])).toBe("No collection");
  });
});
