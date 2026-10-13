import { describe, expect, it } from "vitest";
import {
  isTaxonomyId,
  normalizeCategoryLabel,
  resolveProductTaxonomyCategory,
} from "@/lib/shopify/taxonomy";

describe("lib/shopify/taxonomy", () => {
  describe("helpers", () => {
    it("identifies valid taxonomy IDs", () => {
      expect(isTaxonomyId("gid://shopify/TaxonomyCategory/aa-6-11")).toBe(true);
      expect(isTaxonomyId("gid://shopify/ProductTaxonomyNode/12345")).toBe(true);
      expect(isTaxonomyId("aa-6-11")).toBe(true);
      expect(isTaxonomyId("sg-2-21")).toBe(true);
      expect(isTaxonomyId("Watches")).toBe(false);
      expect(isTaxonomyId("")).toBe(false);
    });

    it("normalizes category labels", () => {
      expect(normalizeCategoryLabel("  Men's   Watches  ")).toBe("mens watches");
      expect(normalizeCategoryLabel("Apparel > Clothing > Shirts")).toBe(
        "apparel > clothing > shirts",
      );
    });
  });

  describe("resolveProductTaxonomyCategory", () => {
    it("resolves Men's Watches to official Watches taxonomy category", () => {
      const result = resolveProductTaxonomyCategory({
        productType: "Men's Watches",
        title: "HEROFORCE HF5025B Octagonal Stainless Steel Men's Watch",
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe("gid://shopify/TaxonomyCategory/aa-6-11");
      expect(result?.fullName).toBe("Apparel & Accessories > Jewelry > Watches");
    });

    it("resolves Snowboards from title when productType is missing", () => {
      const result = resolveProductTaxonomyCategory({
        title: "The Collection Snowboard: Liquid",
      });

      expect(result).not.toBeNull();
      expect(result?.fullName).toContain("Snowboards");
    });

    it("resolves categories from tags as fallback", () => {
      const result = resolveProductTaxonomyCategory({
        productType: "Custom Gear",
        title: "Model 900",
        tags: ["handbag", "leather"],
      });

      expect(result).not.toBeNull();
      expect(result?.fullName).toContain("Handbags");
    });
  });
});
