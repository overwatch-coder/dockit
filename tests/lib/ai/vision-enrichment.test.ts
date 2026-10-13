import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  analyzeProductPhotosWithVision,
  generateFullProductFields,
  generatePerspectiveImages,
  runFullProductAiVisionEnrichment,
} from "@/lib/ai/vision-enrichment";
import * as blobModule from "@/lib/blob/products";

describe("vision-enrichment", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("analyzeProductPhotosWithVision", () => {
    it("parses valid vision analysis response from Gemini", async () => {
      const mockVisionResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    visualSummary: "Matte black insulated water bottle with wood lid",
                    identifiedProduct: "Thermal Water Bottle",
                    materials: ["Stainless Steel", "Bamboo"],
                    colors: ["Matte Black"],
                    detectedAngles: ["Front Angle"],
                    keyFeatures: ["Double-wall vacuum insulation", "Leak-proof cap"],
                    targetCategoryGuess: "Water Bottles",
                    recommendedPerspectives: ["Side Profile", "Macro Cap"],
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockVisionResponse,
      } as Response);

      const result = await analyzeProductPhotosWithVision({
        title: "Test Bottle",
        imageUrls: [],
        apiKey: "fake-test-key",
      });

      expect(result.identifiedProduct).toBe("Thermal Water Bottle");
      expect(result.materials).toContain("Stainless Steel");
      expect(result.targetCategoryGuess).toBe("Water Bottles");
    });

    it("throws error if API returns non-OK status", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      } as Response);

      await expect(
        analyzeProductPhotosWithVision({
          title: "Test Bottle",
          imageUrls: [],
          apiKey: "fake-test-key",
        })
      ).rejects.toThrow(/vision analysis failed \(400\)/i);
    });
  });

  describe("generateFullProductFields", () => {
    it("generates sanitized product fields and resolves category taxonomy", async () => {
      const mockFieldsResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: "PeakFlow 32oz Insulated Stainless Steel Bottle",
                    descriptionHtml:
                      "<p>Keep beverages icy cold for 24 hours.</p><ul><li><strong>Double Wall:</strong> Prevents sweat.</li></ul><script>alert(1)</script>",
                    categoryGuess: "Water Bottles",
                    tags: ["water-bottle", "insulated", "stainless-steel"],
                    seoTitle: "PeakFlow 32oz Insulated Bottle | Dockit",
                    seoDescription: "Stay hydrated all day with the PeakFlow vacuum-insulated bottle.",
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFieldsResponse,
      } as Response);

      const analysis = {
        visualSummary: "Black bottle",
        identifiedProduct: "Water Bottle",
        materials: ["Steel"],
        colors: ["Black"],
        detectedAngles: ["Front"],
        keyFeatures: ["Insulation"],
        targetCategoryGuess: "Water Bottles",
        recommendedPerspectives: [],
      };

      const result = await generateFullProductFields({
        title: "Simple Bottle",
        analysis,
        apiKey: "fake-test-key",
      });

      expect(result.title).toBe("PeakFlow 32oz Insulated Stainless Steel Bottle");
      expect(result.descriptionHtml).not.toContain("<script>");
      expect(result.descriptionHtml).toContain("<strong>Double Wall:</strong>");
      expect(result.tags).toHaveLength(3);
      // Confirms taxonomy category was resolved
      expect(result.categoryFullName).toBeDefined();
    });

    it("injects custom store AI rules into generation prompt", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: "EcoBottle Pro",
                      descriptionHtml: "<p>Eco friendly bottle.</p>",
                      categoryGuess: "Water Bottles",
                      tags: ["eco", "bottle"],
                      seoTitle: "EcoBottle Pro",
                      seoDescription: "High quality eco bottle.",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as Response);
      global.fetch = mockFetch;

      const analysis = {
        visualSummary: "Green bottle",
        identifiedProduct: "Water Bottle",
        materials: ["Bamboo"],
        colors: ["Green"],
        detectedAngles: ["Front"],
        keyFeatures: ["Eco friendly"],
        targetCategoryGuess: "Water Bottles",
        recommendedPerspectives: [],
      };

      await generateFullProductFields({
        title: "Eco Bottle",
        analysis,
        rules: {
          brandTone: "Artisanal organic storyteller",
          titleRule: "Always start with Eco",
          descriptionRule: "Highlight 100% sustainable materials",
          tagsRule: "Eco tags only",
          seoRule: "Green SEO snippet",
          customInstructions: "Never mention plastic",
        },
        apiKey: "fake-test-key",
      });

      const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const promptSent = calledBody.contents[0].parts[0].text;
      expect(promptSent).toContain("Artisanal organic storyteller");
      expect(promptSent).toContain("Always start with Eco");
      expect(promptSent).toContain("Never mention plastic");
    });
  });

  describe("generatePerspectiveImages", () => {
    it("uploads generated images to blob and returns structured perspective items", async () => {
      const mockImageFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("models/gemini-2.5-flash-image")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        inlineData: {
                          mimeType: "image/png",
                          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          });
        }
        // Downloading reference photo
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(8),
          headers: new Headers({ "content-type": "image/jpeg" }),
        });
      });

      global.fetch = mockImageFetch as any;

      vi.spyOn(blobModule, "uploadGeneratedProductImage").mockResolvedValue({
        success: true,
        url: "https://blob.vercel-storage.com/products/p1/ai-side-123.png",
      });

      const images = await generatePerspectiveImages({
        productId: "p1",
        referenceImageUrl: "https://example.com/photo.jpg",
        angles: ["side"],
        apiKey: "fake-test-key",
      });

      expect(images).toHaveLength(1);
      expect(images[0]?.angle).toBe("side");
      expect(images[0]?.url).toBe("https://blob.vercel-storage.com/products/p1/ai-side-123.png");
    });
  });

  describe("runFullProductAiVisionEnrichment", () => {
    it("orchestrates vision analysis and field generation", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    visualSummary: "White ceramic coffee mug",
                    identifiedProduct: "Ceramic Coffee Mug",
                    materials: ["Ceramic"],
                    colors: ["White"],
                    detectedAngles: ["Front"],
                    keyFeatures: ["Comfort handle"],
                    targetCategoryGuess: "Coffee Mugs",
                    recommendedPerspectives: [],
                    title: "Artisan Ceramic Mug 12oz",
                    descriptionHtml: "<p>Handcrafted ceramic mug.</p>",
                    tags: ["mug", "coffee"],
                    seoTitle: "Artisan Ceramic Mug 12oz | Dockit",
                    seoDescription: "Classic white handcrafted ceramic mug.",
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await runFullProductAiVisionEnrichment({
        productId: "p1",
        title: "Mug",
        imageUrls: [],
        generateImages: false,
        apiKey: "fake-test-key",
      });

      expect(result.analysis.identifiedProduct).toBe("Ceramic Coffee Mug");
      expect(result.fields.title).toBe("Artisan Ceramic Mug 12oz");
      expect(result.generatedImages).toEqual([]);
    });
  });
});
