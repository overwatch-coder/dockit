import { describe, expect, it } from "vitest";
import {
  visionAnalysisSchema,
  enrichedProductFieldsSchema,
  generatedPerspectiveImageSchema,
  fullAiVisionEnrichmentResultSchema,
} from "@/lib/validation/ai-vision-enrichment";

describe("visionAnalysisSchema", () => {
  it("validates a complete vision analysis object", () => {
    const raw = {
      visualSummary: "Matte black stainless steel bottle with bamboo cap",
      identifiedProduct: "Thermal Water Bottle",
      materials: ["Stainless Steel", "Bamboo"],
      colors: ["Matte Black"],
      detectedAngles: ["Front 3/4"],
      keyFeatures: ["Vacuum insulation", "Carry loop"],
      targetCategoryGuess: "Water Bottles",
      recommendedPerspectives: ["Side Profile", "Macro Cap Close-up"],
    };

    const parsed = visionAnalysisSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.identifiedProduct).toBe("Thermal Water Bottle");
      expect(parsed.data.materials).toHaveLength(2);
    }
  });

  it("handles missing optional arrays with defaults", () => {
    const raw = {
      visualSummary: "Wireless gaming mouse",
      identifiedProduct: "Gaming Mouse",
    };

    const parsed = visionAnalysisSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.materials).toEqual([]);
      expect(parsed.data.colors).toEqual([]);
      expect(parsed.data.targetCategoryGuess).toBeNull();
    }
  });
});

describe("enrichedProductFieldsSchema", () => {
  it("validates full product fields", () => {
    const raw = {
      title: "HydroFlask 32oz Insulated Stainless Steel Bottle",
      descriptionHtml: "<p>Keep beverages cold for 24 hours.</p>",
      categoryGuess: "Water Bottles",
      categoryId: "gid://shopify/TaxonomyCategory/123",
      categoryFullName: "Home & Garden > Kitchen > Drinkware > Water Bottles",
      tags: ["drinkware", "vacuum-insulated", "water-bottle"],
      seoTitle: "HydroFlask 32oz Insulated Bottle | Dockit Store",
      seoDescription: "Shop the 32oz vacuum insulated stainless steel water bottle. All-day hydration.",
    };

    const parsed = enrichedProductFieldsSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.collectionId).toBeNull();
      expect(parsed.data.collectionTitle).toBeNull();
    }
  });

  it("validates fields with collection assigned", () => {
    const raw = {
      title: "HydroFlask 32oz Insulated Stainless Steel Bottle",
      descriptionHtml: "<p>Keep beverages cold for 24 hours.</p>",
      categoryGuess: "Water Bottles",
      categoryId: "gid://shopify/TaxonomyCategory/123",
      categoryFullName: "Home & Garden > Kitchen > Drinkware > Water Bottles",
      collectionId: "gid://shopify/Collection/456",
      collectionTitle: "Summer Gear",
      tags: ["drinkware"],
      seoTitle: "HydroFlask 32oz Insulated Bottle",
      seoDescription: "Shop the 32oz vacuum insulated stainless steel water bottle.",
    };

    const parsed = enrichedProductFieldsSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.collectionId).toBe("gid://shopify/Collection/456");
      expect(parsed.data.collectionTitle).toBe("Summer Gear");
    }
  });
});

describe("generatedPerspectiveImageSchema", () => {
  it("validates valid perspective image item", () => {
    const raw = {
      url: "https://blob.vercel-storage.com/products/123/side.png",
      label: "Side Profile Studio Shot",
      angle: "side",
    };

    const parsed = generatedPerspectiveImageSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it("rejects non-URL strings", () => {
    const raw = {
      url: "invalid-url",
      label: "Side Profile",
      angle: "side",
    };

    const parsed = generatedPerspectiveImageSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });
});

describe("fullAiVisionEnrichmentResultSchema", () => {
  it("validates complete enrichment payload", () => {
    const raw = {
      analysis: {
        visualSummary: "White ceramic coffee mug",
        identifiedProduct: "Coffee Mug",
      },
      fields: {
        title: "Artisan Ceramic Coffee Mug - 12oz",
        descriptionHtml: "<p>Hand-thrown ceramic mug.</p>",
        seoTitle: "Artisan Ceramic Coffee Mug 12oz",
        seoDescription: "Handcrafted ceramic mug perfect for pour-over coffee.",
      },
      generatedImages: [
        {
          url: "https://blob.vercel-storage.com/mug-angle.png",
          label: "Hero 45° Angle",
          angle: "angle_45",
        },
      ],
    };

    const parsed = fullAiVisionEnrichmentResultSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });
});
