import { describe, expect, it } from "vitest";
import { shopifyThumbnailUrl } from "@/lib/shopify/image-url";

describe("shopifyThumbnailUrl", () => {
  it("appends width/height params to a plain CDN URL", () => {
    const result = shopifyThumbnailUrl("https://cdn.shopify.com/s/files/1/0001/product.jpg", 80);
    expect(result).toBe("https://cdn.shopify.com/s/files/1/0001/product.jpg?width=80&height=80");
  });

  it("preserves an existing query string (e.g. Shopify's own ?v= cache-buster)", () => {
    const result = shopifyThumbnailUrl("https://cdn.shopify.com/s/files/1/0001/product.jpg?v=123456", 80);
    expect(result).toContain("v=123456");
    expect(result).toContain("width=80");
    expect(result).toContain("height=80");
  });

  it("overwrites pre-existing width/height params rather than duplicating them", () => {
    const result = shopifyThumbnailUrl(
      "https://cdn.shopify.com/s/files/1/0001/product.jpg?width=2000&height=2000",
      80
    );
    const url = new URL(result);
    expect(url.searchParams.getAll("width")).toEqual(["80"]);
    expect(url.searchParams.getAll("height")).toEqual(["80"]);
  });

  it("returns malformed/relative input unchanged instead of throwing", () => {
    expect(shopifyThumbnailUrl("/relative/path.jpg", 80)).toBe("/relative/path.jpg");
    expect(shopifyThumbnailUrl("", 80)).toBe("");
  });
});
