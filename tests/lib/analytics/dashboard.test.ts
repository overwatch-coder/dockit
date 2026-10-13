import { describe, it, expect } from "vitest";
import {
  getActivityTimelineData,
  getCategoryBreakdownData,
  getStatusDistributionData,
  getCatalogMetrics,
} from "@/lib/analytics/dashboard";
import type { Product } from "@/types/product";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    storeId: "store-1",
    shopifyProductId: "shopify-1",
    title: "Snowboard",
    description: "A test snowboard",
    imageUrl: "https://cdn.shopify.com/img.png",
    imageUrls: ["https://cdn.shopify.com/img.png"],
    price: "199.99",
    status: "ACTIVE",
    tags: ["winter", "sports"],
    collectionId: "col-1",
    collectionTitle: "Winter Sports",
    categoryId: "cat-1",
    categoryFullName: "Sporting Goods > Winter Sports > Snowboards",
    seoTitle: null,
    seoDescription: null,
    lastEditedAt: new Date("2026-10-13T10:00:00Z"),
    lastSyncedAt: new Date("2026-10-13T10:00:00Z"),
    isConflicted: false,
    conflictAppSnapshot: null,
    conflictShopifySnapshot: null,
    variants: [
      {
        id: "var-1",
        shopifyVariantId: "shvar-1",
        optionName: "Default Title",
        price: "199.99",
        inventory: 15,
        imageUrl: null,
      },
    ],
    ...overrides,
  };
}

describe("lib/analytics/dashboard", () => {
  const refDate = new Date("2026-10-13T12:00:00Z");

  describe("getActivityTimelineData", () => {
    it("returns the exact number of days requested", () => {
      const data7 = getActivityTimelineData([], 7, refDate);
      expect(data7).toHaveLength(7);
      expect(data7[6].date).toBe("2026-10-13");
      expect(data7[0].date).toBe("2026-10-07");

      const data14 = getActivityTimelineData([], 14, refDate);
      expect(data14).toHaveLength(14);
    });

    it("correctly buckets synced and edited products into appropriate days", () => {
      const p1 = makeProduct({
        id: "p1",
        lastSyncedAt: new Date("2026-10-13T09:00:00Z"),
        lastEditedAt: new Date("2026-10-13T09:00:00Z"),
      });
      const p2 = makeProduct({
        id: "p2",
        lastSyncedAt: new Date("2026-10-12T14:00:00Z"),
        lastEditedAt: new Date("2026-10-13T11:00:00Z"),
      });
      const p3 = makeProduct({
        id: "p3",
        lastSyncedAt: null,
        lastEditedAt: new Date("2026-10-10T10:00:00Z"),
      });

      const timeline = getActivityTimelineData([p1, p2, p3], 7, refDate);

      const day13 = timeline.find((d) => d.date === "2026-10-13");
      expect(day13?.synced).toBe(1);
      expect(day13?.edited).toBe(2);

      const day12 = timeline.find((d) => d.date === "2026-10-12");
      expect(day12?.synced).toBe(1);
      expect(day12?.edited).toBe(0);

      const day10 = timeline.find((d) => d.date === "2026-10-10");
      expect(day10?.synced).toBe(0);
      expect(day10?.edited).toBe(1);
    });

    it("handles an empty product list safely", () => {
      const timeline = getActivityTimelineData([], 7, refDate);
      expect(timeline).toHaveLength(7);
      for (const day of timeline) {
        expect(day.synced).toBe(0);
        expect(day.edited).toBe(0);
      }
    });
  });

  describe("getCategoryBreakdownData", () => {
    it("groups products by taxonomy category leaf and computes percentages", () => {
      const p1 = makeProduct({ categoryFullName: "Sporting Goods > Snowboards" });
      const p2 = makeProduct({ categoryFullName: "Sporting Goods > Snowboards" });
      const p3 = makeProduct({ categoryFullName: "Sporting Goods > Ski Wax" });
      const p4 = makeProduct({ categoryFullName: null, collectionTitle: "Accessories" });
      const p5 = makeProduct({ categoryFullName: null, collectionTitle: null });

      const breakdown = getCategoryBreakdownData([p1, p2, p3, p4, p5]);

      expect(breakdown[0]).toEqual({
        name: "Snowboards",
        count: 2,
        percentage: 40,
      });
      expect(breakdown[1]).toEqual({
        name: "Ski Wax",
        count: 1,
        percentage: 20,
      });
      expect(breakdown[2]).toEqual({
        name: "Accessories",
        count: 1,
        percentage: 20,
      });
      expect(breakdown[3]).toEqual({
        name: "Uncategorized",
        count: 1,
        percentage: 20,
      });
    });

    it("caps results to maxCategories and sorts descending", () => {
      const products = Array.from({ length: 10 }, (_, i) =>
        makeProduct({ id: `p-${i}`, categoryFullName: `Category > Cat ${i}` })
      );
      const breakdown = getCategoryBreakdownData(products, 5);
      expect(breakdown.length).toBeLessThanOrEqual(5);
    });

    it("returns empty array for empty product list", () => {
      expect(getCategoryBreakdownData([])).toEqual([]);
    });
  });

  describe("getStatusDistributionData", () => {
    it("aggregates active, draft, and conflicted products", () => {
      const p1 = makeProduct({ status: "ACTIVE", isConflicted: false });
      const p2 = makeProduct({ status: "ACTIVE", isConflicted: false });
      const p3 = makeProduct({ status: "DRAFT", isConflicted: false });
      const p4 = makeProduct({ status: "ACTIVE", isConflicted: true });

      const dist = getStatusDistributionData([p1, p2, p3, p4]);

      expect(dist.summary).toEqual({
        total: 4,
        active: 2,
        draft: 1,
        conflict: 1,
      });

      const activeSlice = dist.chartData.find((d) => d.key === "active");
      expect(activeSlice?.count).toBe(2);
      expect(activeSlice?.percentage).toBe(50);

      const conflictSlice = dist.chartData.find((d) => d.key === "conflict");
      expect(conflictSlice?.count).toBe(1);
      expect(conflictSlice?.percentage).toBe(25);
    });

    it("handles empty product list without NaN", () => {
      const dist = getStatusDistributionData([]);
      expect(dist.summary.total).toBe(0);
      expect(dist.chartData.every((d) => !Number.isNaN(d.percentage))).toBe(true);
    });
  });

  describe("getCatalogMetrics", () => {
    it("calculates totals, variants, inventory, and average price", () => {
      const p1 = makeProduct({
        price: "100.00",
        variants: [
          {
            id: "v1",
            shopifyVariantId: "sh1",
            optionName: "Small",
            price: "100.00",
            inventory: 10,
            imageUrl: null,
          },
          {
            id: "v2",
            shopifyVariantId: "sh2",
            optionName: "Large",
            price: "120.00",
            inventory: 5,
            imageUrl: null,
          },
        ],
      });
      const p2 = makeProduct({
        price: "50.00",
        variants: [
          {
            id: "v3",
            shopifyVariantId: "sh3",
            optionName: "Default",
            price: "50.00",
            inventory: 20,
            imageUrl: null,
          },
        ],
      });

      const metrics = getCatalogMetrics([p1, p2]);
      expect(metrics.totalProducts).toBe(2);
      expect(metrics.totalVariants).toBe(3);
      expect(metrics.totalInventory).toBe(35);
      expect(metrics.averagePrice).toBe(75.0);
    });

    it("handles empty product list", () => {
      const metrics = getCatalogMetrics([]);
      expect(metrics.totalProducts).toBe(0);
      expect(metrics.totalVariants).toBe(0);
      expect(metrics.totalInventory).toBe(0);
      expect(metrics.averagePrice).toBe(0);
    });
  });
});
