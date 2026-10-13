import { describe, expect, it } from "vitest";
import {
  filterSelectedImages,
  formatTaxonomyBreadcrumb,
  getInitialAnglesSelection,
} from "@/components/product-vision-enrich-dialog";
import type { GeneratedPerspectiveImage } from "@/lib/validation/ai-vision-enrichment";

describe("product-vision-enrich-dialog helpers", () => {
  describe("filterSelectedImages", () => {
    it("returns only image URLs that the owner selected", () => {
      const generatedImages: GeneratedPerspectiveImage[] = [
        { url: "https://blob.com/1.png", label: "Side", angle: "side" },
        { url: "https://blob.com/2.png", label: "Angle", angle: "angle_45" },
        { url: "https://blob.com/3.png", label: "Macro", angle: "macro_detail" },
      ];
      const selected = new Set(["https://blob.com/1.png", "https://blob.com/3.png"]);

      const result = filterSelectedImages(generatedImages, selected);
      expect(result).toEqual(["https://blob.com/1.png", "https://blob.com/3.png"]);
    });

    it("returns empty array if no images selected", () => {
      const generatedImages: GeneratedPerspectiveImage[] = [
        { url: "https://blob.com/1.png", label: "Side", angle: "side" },
      ];
      const selected = new Set<string>();

      const result = filterSelectedImages(generatedImages, selected);
      expect(result).toEqual([]);
    });
  });

  describe("formatTaxonomyBreadcrumb", () => {
    it("formats full category breadcrumbs cleanly", () => {
      const full = "Home & Garden > Kitchen > Drinkware > Water Bottles";
      const formatted = formatTaxonomyBreadcrumb(full);
      expect(formatted).toBe("Home & Garden > Kitchen > Drinkware > Water Bottles");
    });

    it("falls back to default text when null or empty", () => {
      expect(formatTaxonomyBreadcrumb(null)).toBe("No taxonomy matched");
      expect(formatTaxonomyBreadcrumb("")).toBe("No taxonomy matched");
    });
  });

  describe("getInitialAnglesSelection", () => {
    it("selects all generated image URLs by default", () => {
      const images: GeneratedPerspectiveImage[] = [
        { url: "https://blob.com/a.png", label: "A", angle: "side" },
        { url: "https://blob.com/b.png", label: "B", angle: "angle_45" },
      ];
      const selectedSet = getInitialAnglesSelection(images);
      expect(selectedSet.has("https://blob.com/a.png")).toBe(true);
      expect(selectedSet.has("https://blob.com/b.png")).toBe(true);
      expect(selectedSet.size).toBe(2);
    });
  });
});
