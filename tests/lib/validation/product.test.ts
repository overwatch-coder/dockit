import { describe, expect, it } from "vitest";
import { productFormSchema } from "@/lib/validation/product";

describe("productFormSchema", () => {
  it("accepts valid input", () => {
    const result = productFormSchema.safeParse({
      title: "Wide-leg Jeans",
      description: "<p>Great fit</p>",
      price: "49.99",
      status: "DRAFT",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = productFormSchema.safeParse({
      title: "   ",
      description: "",
      price: "10.00",
      status: "DRAFT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = productFormSchema.safeParse({
      title: "Jeans",
      description: "",
      price: "-5.00",
      status: "DRAFT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric price", () => {
    const result = productFormSchema.safeParse({
      title: "Jeans",
      description: "",
      price: "free",
      status: "DRAFT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status", () => {
    const result = productFormSchema.safeParse({
      title: "Jeans",
      description: "",
      price: "10.00",
      status: "PUBLISHED",
    });
    expect(result.success).toBe(false);
  });
});
