import { describe, expect, it } from "vitest";
import { isValidVariantImageUrl } from "@/lib/db/variants";

describe("isValidVariantImageUrl", () => {
  it("accepts null (no image linked)", () => {
    expect(isValidVariantImageUrl({ imageUrl: "https://cdn/a.jpg", imageUrls: ["https://cdn/a.jpg"] }, null)).toBe(
      true
    );
  });

  it("accepts a url that's in the product's imageUrls gallery", () => {
    const product = { imageUrl: "https://cdn/a.jpg", imageUrls: ["https://cdn/a.jpg", "https://cdn/b.jpg"] };
    expect(isValidVariantImageUrl(product, "https://cdn/b.jpg")).toBe(true);
  });

  it("rejects a url that isn't in the product's imageUrls gallery", () => {
    const product = { imageUrl: "https://cdn/a.jpg", imageUrls: ["https://cdn/a.jpg"] };
    expect(isValidVariantImageUrl(product, "https://cdn/other.jpg")).toBe(false);
  });

  it("falls back to the legacy single imageUrl when imageUrls is empty", () => {
    const product = { imageUrl: "https://cdn/a.jpg", imageUrls: [] };
    expect(isValidVariantImageUrl(product, "https://cdn/a.jpg")).toBe(true);
    expect(isValidVariantImageUrl(product, "https://cdn/other.jpg")).toBe(false);
  });

  it("rejects any url when the product has no images at all", () => {
    const product = { imageUrl: null, imageUrls: [] };
    expect(isValidVariantImageUrl(product, "https://cdn/a.jpg")).toBe(false);
  });
});
