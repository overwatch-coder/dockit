import { describe, expect, test } from "vitest";
import { buildProductsCsv } from "@/lib/csv/products";
import type { Product } from "@/types/product";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    storeId: "store1",
    shopifyProductId: null,
    title: "Test Product",
    description: null,
    imageUrl: null,
    imageUrls: [],
    price: "19.99",
    status: "DRAFT",
    tags: [],
    collectionId: null,
    collectionTitle: null,
    categoryId: null,
    categoryFullName: null,
    seoTitle: null,
    seoDescription: null,
    isConflicted: false,
    conflictAppSnapshot: null,
    conflictShopifySnapshot: null,
    variants: [],
    lastSyncedAt: null,
    ...overrides,
  };
}

function rows(csv: string): string[] {
  return csv.split("\r\n");
}

describe("buildProductsCsv", () => {
  test("always includes the header row, even with no products", () => {
    const csv = buildProductsCsv([]);
    expect(rows(csv)).toEqual(["Title,Price,Status,Category,Tags,Variants,Last Synced"]);
  });

  test("renders a plain product's core fields", () => {
    const csv = buildProductsCsv([
      baseProduct({ title: "Blue Shirt", price: "24.99", status: "ACTIVE", collectionTitle: "Shirts" }),
    ]);
    expect(rows(csv)[1]).toBe("Blue Shirt,24.99,Active,Shirts,,,");
  });

  test("renders DRAFT status as Title Case", () => {
    const csv = buildProductsCsv([baseProduct({ status: "DRAFT" })]);
    expect(rows(csv)[1].split(",")[2]).toBe("Draft");
  });

  test("blanks a missing category rather than a placeholder like —", () => {
    const csv = buildProductsCsv([baseProduct({ collectionTitle: null })]);
    expect(rows(csv)[1].split(",")[3]).toBe("");
  });

  test("joins tags with a semicolon inside one field", () => {
    const csv = buildProductsCsv([baseProduct({ tags: ["summer", "sale"] })]);
    expect(rows(csv)[1]).toContain("summer; sale");
  });

  test("summarizes variants as name (price, qty inventory), joined with a semicolon", () => {
    const csv = buildProductsCsv([
      baseProduct({
        variants: [
          { id: "v1", shopifyVariantId: null, optionName: "Small", price: "10.00", inventory: 5, imageUrl: null },
          { id: "v2", shopifyVariantId: null, optionName: "Large", price: "12.00", inventory: 3, imageUrl: null },
        ],
      }),
    ]);
    expect(rows(csv)[1]).toContain("Small (10.00, qty 5); Large (12.00, qty 3)");
  });

  test("renders lastSyncedAt as a full ISO 8601 timestamp", () => {
    const csv = buildProductsCsv([baseProduct({ lastSyncedAt: new Date("2026-01-15T10:30:00.000Z") })]);
    expect(rows(csv)[1].split(",").pop()).toBe("2026-01-15T10:30:00.000Z");
  });

  test("blanks Last Synced for a never-synced product", () => {
    const csv = buildProductsCsv([baseProduct({ lastSyncedAt: null })]);
    expect(rows(csv)[1].split(",").pop()).toBe("");
  });

  test("quotes a title containing a comma", () => {
    const csv = buildProductsCsv([baseProduct({ title: "Shirt, Blue" })]);
    expect(rows(csv)[1].startsWith('"Shirt, Blue",')).toBe(true);
  });

  test("quotes and doubles an internal double quote", () => {
    const csv = buildProductsCsv([baseProduct({ title: 'The "Best" Shirt' })]);
    expect(rows(csv)[1].startsWith('"The ""Best"" Shirt",')).toBe(true);
  });

  test("does not quote a field with no comma, quote, or newline", () => {
    const csv = buildProductsCsv([baseProduct({ title: "Plain Shirt" })]);
    expect(rows(csv)[1].startsWith("Plain Shirt,")).toBe(true);
  });

  test("renders one row per product, in the given order", () => {
    const csv = buildProductsCsv([baseProduct({ title: "First" }), baseProduct({ title: "Second" })]);
    const lines = rows(csv);
    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith("First,")).toBe(true);
    expect(lines[2].startsWith("Second,")).toBe(true);
  });
});
