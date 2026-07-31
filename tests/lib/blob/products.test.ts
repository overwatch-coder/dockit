import { describe, expect, it } from "vitest";
import { isBlobUrl } from "@/lib/blob/products";

describe("isBlobUrl", () => {
  it("recognizes a Vercel Blob public URL", () => {
    expect(isBlobUrl("https://abc123.public.blob.vercel-storage.com/products/1/a-photo.jpg")).toBe(true);
  });

  it("rejects a Shopify CDN URL", () => {
    expect(isBlobUrl("https://cdn.shopify.com/s/files/1/test.jpg")).toBe(false);
  });

  it("rejects a malformed URL instead of throwing", () => {
    expect(isBlobUrl("not-a-url")).toBe(false);
  });
});
