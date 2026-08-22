import { describe, expect, test } from "vitest";
import {
  buildProductsCsv,
  parseAndValidateProductsCsv,
} from "@/lib/csv/products";
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
    expect(rows(csv)).toEqual([
      "Title,Price,Status,Category,Tags,Variants,Last Synced",
    ]);
  });

  test("renders a plain product's core fields", () => {
    const csv = buildProductsCsv([
      baseProduct({
        title: "Blue Shirt",
        price: "24.99",
        status: "ACTIVE",
        collectionTitle: "Shirts",
      }),
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
          {
            id: "v1",
            shopifyVariantId: null,
            optionName: "Small",
            price: "10.00",
            inventory: 5,
            imageUrl: null,
          },
          {
            id: "v2",
            shopifyVariantId: null,
            optionName: "Large",
            price: "12.00",
            inventory: 3,
            imageUrl: null,
          },
        ],
      }),
    ]);
    expect(rows(csv)[1]).toContain(
      "Small (10.00, qty 5); Large (12.00, qty 3)",
    );
  });

  test("renders lastSyncedAt as a full ISO 8601 timestamp", () => {
    const csv = buildProductsCsv([
      baseProduct({ lastSyncedAt: new Date("2026-01-15T10:30:00.000Z") }),
    ]);
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
    const csv = buildProductsCsv([
      baseProduct({ title: "First" }),
      baseProduct({ title: "Second" }),
    ]);
    const lines = rows(csv);
    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith("First,")).toBe(true);
    expect(lines[2].startsWith("Second,")).toBe(true);
  });
});

describe("parseCsv and parseAndValidateProductsCsv", () => {
  test("parses a standard CSV string into rows and fields", () => {
    const csv = "Title,Price,Status\r\nShirt,19.99,Draft\r\nPants,29.99,Active";
    const result = parseAndValidateProductsCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.validProducts).toHaveLength(2);
    expect(result.validProducts[0]).toEqual({
      title: "Shirt",
      price: "19.99",
      status: "DRAFT",
      collectionTitle: null,
      tags: [],
      variants: [],
      description: "",
    });
    expect(result.validProducts[1].status).toBe("ACTIVE");
  });

  test("handles quoted fields, escaped quotes, and commas inside fields", () => {
    const csv =
      'Title,Price\r\n"Shirt, Blue","19.99"\r\n"The ""Best"" Hat",15.00';
    const result = parseAndValidateProductsCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.validProducts[0].title).toBe("Shirt, Blue");
    expect(result.validProducts[1].title).toBe('The "Best" Hat');
  });

  test("normalizes alternative header aliases", () => {
    const csv =
      'Product Name,MSRP,Product Status,Category,Keywords\r\nSneakers,89.99,Active,Footwear,"shoes; sports"';
    const result = parseAndValidateProductsCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.validProducts[0]).toEqual({
      title: "Sneakers",
      price: "89.99",
      status: "ACTIVE",
      collectionTitle: "Footwear",
      tags: ["shoes", "sports"],
      variants: [],
      description: "",
    });
  });

  test("flags errors for missing title or invalid price", () => {
    const csv = "Title,Price\r\n,19.99\r\nShirt,invalid_price";
    const result = parseAndValidateProductsCsv(csv);
    expect(result.validProducts).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].rowNumber).toBe(2);
    expect(result.errors[0].messages[0]).toContain("Title is required");
    expect(result.errors[1].rowNumber).toBe(3);
    expect(result.errors[1].messages[0]).toContain(
      "must be a valid non-negative number",
    );
  });

  test("parses variant summary string", () => {
    const csv =
      'Title,Price,Variants\r\nShirt,20.00,"Small (20.00, qty 5); Large (25.00, qty 10)"';
    const result = parseAndValidateProductsCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.validProducts[0].variants).toEqual([
      { optionName: "Small", price: "20.00", inventory: 5 },
      { optionName: "Large", price: "25.00", inventory: 10 },
    ]);
  });
});
