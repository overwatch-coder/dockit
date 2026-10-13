import { describe, expect, it } from "vitest";
import {
  formatSyncCategoryDisplay,
  formatSyncImportButtonText,
  formatSyncSelectionCount,
  MAX_SELECTION,
} from "@/components/shopify-sync-modal";

describe("shopify-sync-modal helpers", () => {
  describe("formatSyncCategoryDisplay", () => {
    it("extracts the leaf category name when hierarchical breadcrumb is given", () => {
      expect(
        formatSyncCategoryDisplay("Apparel & Accessories > Clothing > Shirts")
      ).toBe("Shirts");
    });

    it("returns the full string when no hierarchy delimiter is present", () => {
      expect(formatSyncCategoryDisplay("Snowboards")).toBe("Snowboards");
    });

    it("falls back to collectionTitle when category is null or empty", () => {
      expect(formatSyncCategoryDisplay(null, "Winter 2026")).toBe("Winter 2026");
      expect(formatSyncCategoryDisplay("", "Winter 2026")).toBe("Winter 2026");
      expect(formatSyncCategoryDisplay("   ", "Winter 2026")).toBe("Winter 2026");
    });

    it("returns null if neither category nor collection title is provided", () => {
      expect(formatSyncCategoryDisplay(null, null)).toBeNull();
      expect(formatSyncCategoryDisplay("", "")).toBeNull();
      expect(formatSyncCategoryDisplay("   ", "   ")).toBeNull();
    });
  });

  describe("formatSyncSelectionCount", () => {
    it("pluralizes products correctly for 0, 1, and many without total", () => {
      expect(formatSyncSelectionCount(0)).toBe("0 products selected");
      expect(formatSyncSelectionCount(1)).toBe("1 product selected");
      expect(formatSyncSelectionCount(5)).toBe("5 products selected");
    });

    it("includes total count when provided", () => {
      expect(formatSyncSelectionCount(0, 10)).toBe("0 products selected of 10");
      expect(formatSyncSelectionCount(1, 10)).toBe("1 product selected of 10");
      expect(formatSyncSelectionCount(4, 10)).toBe("4 products selected of 10");
    });
  });

  describe("formatSyncImportButtonText", () => {
    it("formats desktop labels cleanly", () => {
      expect(formatSyncImportButtonText(0, false)).toBe("Import Selected");
      expect(formatSyncImportButtonText(3, false)).toBe("Import Selected (3)");
    });

    it("formats compact mobile labels without overflow", () => {
      expect(formatSyncImportButtonText(0, true)).toBe("Import");
      expect(formatSyncImportButtonText(3, true)).toBe("Import (3)");
    });
  });

  describe("MAX_SELECTION", () => {
    it("caps max selection at 100 products per sync job", () => {
      expect(MAX_SELECTION).toBe(100);
    });
  });
});
