import { describe, expect, it } from "vitest";
import { variantFormSchema } from "@/lib/validation/variant";

describe("variantFormSchema", () => {
  it("accepts valid input", () => {
    const result = variantFormSchema.safeParse({
      optionName: "Small / Blue",
      price: "24.99",
      inventory: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty option name", () => {
    const result = variantFormSchema.safeParse({ optionName: "  ", price: "10.00", inventory: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = variantFormSchema.safeParse({ optionName: "Small", price: "-1.00", inventory: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative inventory", () => {
    const result = variantFormSchema.safeParse({ optionName: "Small", price: "10.00", inventory: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer inventory", () => {
    const result = variantFormSchema.safeParse({ optionName: "Small", price: "10.00", inventory: 1.5 });
    expect(result.success).toBe(false);
  });

  it("reports a helpful validation message for a non-numeric inventory value", () => {
    const result = variantFormSchema.safeParse({ optionName: "Small", price: "10.00", inventory: "NaN" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Inventory must be a whole number");
    }
  });

  it("coerces a numeric string inventory", () => {
    const result = variantFormSchema.safeParse({ optionName: "Small", price: "10.00", inventory: "5" });
    expect(result.success).toBe(true);
  });

  it("defaults imageUrl to null when the field is absent", () => {
    const result = variantFormSchema.safeParse({ optionName: "Small", price: "10.00", inventory: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.imageUrl).toBeNull();
    }
  });

  it("accepts an explicit null imageUrl", () => {
    const result = variantFormSchema.safeParse({
      optionName: "Small",
      price: "10.00",
      inventory: 0,
      imageUrl: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.imageUrl).toBeNull();
    }
  });

  it("accepts a non-empty imageUrl string", () => {
    const result = variantFormSchema.safeParse({
      optionName: "Small",
      price: "10.00",
      inventory: 0,
      imageUrl: "https://cdn.shopify.com/s/files/1/test.jpg",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.imageUrl).toBe("https://cdn.shopify.com/s/files/1/test.jpg");
    }
  });

  it("rejects an empty-string imageUrl", () => {
    const result = variantFormSchema.safeParse({ optionName: "Small", price: "10.00", inventory: 0, imageUrl: "" });
    expect(result.success).toBe(false);
  });
});
