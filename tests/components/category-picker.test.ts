import { describe, expect, test } from "vitest";
import { formatCategoryBreadcrumb } from "@/components/category-picker";

describe("formatCategoryBreadcrumb", () => {
  test("keeps only the last two segments of a longer breadcrumb", () => {
    expect(formatCategoryBreadcrumb("Apparel & Accessories > Clothing > Shirts & Tops")).toBe(
      "Clothing > Shirts & Tops"
    );
  });

  test("returns a two-segment breadcrumb unchanged", () => {
    expect(formatCategoryBreadcrumb("Clothing > Shirts & Tops")).toBe("Clothing > Shirts & Tops");
  });

  test("returns a single-segment (root) category unchanged", () => {
    expect(formatCategoryBreadcrumb("Apparel & Accessories")).toBe("Apparel & Accessories");
  });

  test("respects a custom segment count", () => {
    expect(formatCategoryBreadcrumb("A > B > C > D", 3)).toBe("B > C > D");
  });
});
