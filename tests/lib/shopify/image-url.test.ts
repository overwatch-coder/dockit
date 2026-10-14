import { describe, expect, it } from "vitest";
import { productThumbnailUrl, shopifyThumbnailUrl } from "@/lib/shopify/image-url";

describe("productThumbnailUrl", () => {
  it("appends width/height params to a Shopify CDN URL", () => {
    const result = productThumbnailUrl("https://cdn.shopify.com/s/files/1/0001/product.jpg", 80);
    expect(result).toBe("https://cdn.shopify.com/s/files/1/0001/product.jpg?width=80&height=80");
  });

  it("appends width param to a Vercel Blob public CDN URL", () => {
    const result = productThumbnailUrl("https://abc123xyz.public.blob.vercel-storage.com/image.png", 120);
    expect(result).toBe("https://abc123xyz.public.blob.vercel-storage.com/image.png?width=120");
  });

  it("preserves an existing query string (e.g. Shopify's own ?v= cache-buster)", () => {
    const result = productThumbnailUrl("https://cdn.shopify.com/s/files/1/0001/product.jpg?v=123456", 80);
    expect(result).toContain("v=123456");
    expect(result).toContain("width=80");
    expect(result).toContain("height=80");
  });

  it("overwrites pre-existing width/height params rather than duplicating them", () => {
    const result = productThumbnailUrl(
      "https://cdn.shopify.com/s/files/1/0001/product.jpg?width=2000&height=2000",
      80
    );
    const url = new URL(result);
    expect(url.searchParams.getAll("width")).toEqual(["80"]);
    expect(url.searchParams.getAll("height")).toEqual(["80"]);
  });

  it("returns unknown CDN URL unchanged", () => {
    expect(productThumbnailUrl("https://example.com/photo.jpg", 80)).toBe("https://example.com/photo.jpg");
  });

  it("returns malformed/relative input unchanged instead of throwing", () => {
    expect(productThumbnailUrl("/relative/path.jpg", 80)).toBe("/relative/path.jpg");
    expect(productThumbnailUrl("", 80)).toBe("");
  });
});

describe("shopifyThumbnailUrl (backwards compatibility alias)", () => {
  it("delegates to productThumbnailUrl and resizes Shopify CDN URLs", () => {
    const result = shopifyThumbnailUrl("https://cdn.shopify.com/s/files/1/0001/product.jpg", 80);
    expect(result).toBe("https://cdn.shopify.com/s/files/1/0001/product.jpg?width=80&height=80");
  });
});
