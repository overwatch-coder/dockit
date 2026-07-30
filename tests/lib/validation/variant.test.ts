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

  it("coerces a numeric string inventory", () => {
    const result = variantFormSchema.safeParse({ optionName: "Small", price: "10.00", inventory: "5" });
    expect(result.success).toBe(true);
  });
});
