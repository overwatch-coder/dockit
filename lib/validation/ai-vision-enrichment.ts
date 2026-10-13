import { z } from "zod";

export const visionAnalysisSchema = z.object({
  visualSummary: z.string().trim().min(1),
  identifiedProduct: z.string().trim().min(1),
  materials: z.array(z.string().trim()).default([]),
  colors: z.array(z.string().trim()).default([]),
  detectedAngles: z.array(z.string().trim()).default([]),
  keyFeatures: z.array(z.string().trim()).default([]),
  targetCategoryGuess: z.string().trim().nullable().default(null),
  recommendedPerspectives: z.array(z.string().trim()).default([]),
});

export type VisionAnalysis = z.infer<typeof visionAnalysisSchema>;

export const enrichedProductFieldsSchema = z.object({
  title: z.string().trim().min(1),
  descriptionHtml: z.string().trim().min(1),
  categoryGuess: z.string().trim().nullable().default(null),
  categoryId: z.string().trim().nullable().default(null),
  categoryFullName: z.string().trim().nullable().default(null),
  collectionId: z.string().trim().nullable().default(null),
  collectionTitle: z.string().trim().nullable().default(null),
  tags: z.array(z.string().trim()).default([]),
  seoTitle: z.string().trim().min(1),
  seoDescription: z.string().trim().min(1),
  metafields: z
    .array(
      z.object({
        namespace: z.string().default("custom"),
        key: z.string(),
        name: z.string(),
        value: z.string(),
        type: z.string().optional(),
        isCategoryMetafield: z.boolean().optional(),
      })
    )
    .default([]),
});

export type EnrichedProductFields = z.infer<typeof enrichedProductFieldsSchema>;

export const generatedPerspectiveImageSchema = z.object({
  url: z.string().url(),
  label: z.string().trim().min(1),
  angle: z.enum(["side", "angle_45", "macro_detail", "front_studio", "lifestyle", "custom"]),
});

export type GeneratedPerspectiveImage = z.infer<typeof generatedPerspectiveImageSchema>;

export const fullAiVisionEnrichmentResultSchema = z.object({
  analysis: visionAnalysisSchema,
  fields: enrichedProductFieldsSchema,
  generatedImages: z.array(generatedPerspectiveImageSchema).default([]),
  availableCollections: z.array(z.any()).default([]),
  availableCategoryAttributes: z.array(z.any()).default([]),
  availableProductMetafields: z.array(z.any()).default([]),
});

export type FullAiVisionEnrichmentResult = z.infer<typeof fullAiVisionEnrichmentResultSchema>;
