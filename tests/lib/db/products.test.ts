import { describe, expect, it } from "vitest";
import { duplicateProductTitle, shouldSkipSync } from "@/lib/db/products";

describe("duplicateProductTitle", () => {
  it("adds the Copy suffix to the source title", () => {
    expect(duplicateProductTitle("Adu Denim Shirt")).toBe("Adu Denim Shirt Copy");
  });

  it("trims surrounding whitespace before adding the suffix", () => {
    expect(duplicateProductTitle("  Adu Denim Shirt  ")).toBe("Adu Denim Shirt Copy");
  });
});

describe("shouldSkipSync", () => {
  it("returns false when the product has never been synced", () => {
    expect(shouldSkipSync({ lastEditedAt: new Date("2026-01-01"), lastSyncedAt: null })).toBe(false);
  });

  it("returns false when the last edit happened before the last sync", () => {
    expect(
      shouldSkipSync({
        lastEditedAt: new Date("2026-01-01T00:00:00Z"),
        lastSyncedAt: new Date("2026-01-02T00:00:00Z"),
      })
    ).toBe(false);
  });

  it("returns true when the last edit happened after the last sync", () => {
    expect(
      shouldSkipSync({
        lastEditedAt: new Date("2026-01-03T00:00:00Z"),
        lastSyncedAt: new Date("2026-01-02T00:00:00Z"),
      })
    ).toBe(true);
  });

  it("returns false when lastEditedAt exactly equals lastSyncedAt", () => {
    const timestamp = new Date("2026-01-02T00:00:00Z");
    expect(shouldSkipSync({ lastEditedAt: timestamp, lastSyncedAt: timestamp })).toBe(false);
  });

  it("returns false when difference between lastEditedAt and lastSyncedAt is under 1 second", () => {
    const synced = new Date("2026-01-02T00:00:00.000Z");
    const edited = new Date("2026-01-02T00:00:00.500Z");
    expect(shouldSkipSync({ lastEditedAt: edited, lastSyncedAt: synced })).toBe(false);
  });
});

describe("hasConflictDifferences", () => {
  it("returns false when app and shopify snapshots are identical", async () => {
    const { hasConflictDifferences } = await import("@/lib/db/products");
    const snapshot = {
      title: "The Collection Snowboard: Liquid",
      description: null,
      imageUrl: "https://cdn.shopify.com/board.jpg",
      imageUrls: ["https://cdn.shopify.com/board.jpg"],
      price: "749.95",
      status: "ACTIVE" as const,
      tags: ["Accessory", "Sport", "Winter"],
      collectionId: "1",
      collectionTitle: "Automated Collection",
      categoryId: null,
      categoryFullName: null,
      seoTitle: null,
      seoDescription: null,
      variants: [
        {
          shopifyVariantId: "100",
          optionName: "Default Title",
          price: "749.95",
          inventory: 50,
        },
      ],
    };

    expect(hasConflictDifferences(snapshot, snapshot)).toBe(false);
  });

  it("returns false when price formatting differs slightly (e.g. 749.95 vs 749.950)", async () => {
    const { hasConflictDifferences } = await import("@/lib/db/products");
    const app = {
      title: "The Collection Snowboard: Liquid",
      description: null,
      imageUrl: null,
      imageUrls: [],
      price: "749.95",
      status: "ACTIVE" as const,
      tags: [],
      collectionId: null,
      collectionTitle: null,
      categoryId: null,
      categoryFullName: null,
      seoTitle: null,
      seoDescription: null,
      variants: [],
    };
    const shopify = { ...app, price: "749.950" };

    expect(hasConflictDifferences(app, shopify)).toBe(false);
  });

  it("returns true when fields actually differ", async () => {
    const { hasConflictDifferences } = await import("@/lib/db/products");
    const app = {
      title: "The Collection Snowboard: Liquid",
      description: "My local edit",
      imageUrl: null,
      imageUrls: [],
      price: "749.95",
      status: "ACTIVE" as const,
      tags: [],
      collectionId: null,
      collectionTitle: null,
      categoryId: null,
      categoryFullName: null,
      seoTitle: null,
      seoDescription: null,
      variants: [],
    };
    const shopify = { ...app, description: "Shopify remote text" };

    expect(hasConflictDifferences(app, shopify)).toBe(true);
  });
});

