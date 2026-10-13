import type { VisionAnalysis, EnrichedProductFields } from "@/lib/validation/ai-vision-enrichment";
import type { StoreAiRules } from "@/lib/ai/rules";
import type { Collection } from "@/types/collection";

import type { CategoryAttributeDefinition, ProductMetafieldDefinition } from "@/lib/shopify/metafields";

export type TextVisionProviderName = "gemini" | "openai";
export type ImageProviderName = "gemini" | "openai" | "kie";

export interface VisionAnalysisInput {
  title: string;
  imageUrls: string[];
  description?: string | null;
  apiKey?: string;
}

export interface ProductFieldsInput {
  title: string;
  price?: string;
  existingDescriptionHtml?: string | null;
  analysis: VisionAnalysis;
  rules?: StoreAiRules;
  collections?: Collection[];
  categoryAttributes?: CategoryAttributeDefinition[];
  productMetafieldDefinitions?: ProductMetafieldDefinition[];
  apiKey?: string;
}

export interface ITextVisionProvider {
  readonly providerName: TextVisionProviderName;
  analyzePhotos(input: VisionAnalysisInput): Promise<VisionAnalysis>;
  generateFields(input: ProductFieldsInput): Promise<EnrichedProductFields>;
}

export type ImageAspectRatio = "1:1" | "4:3" | "16:9" | "3:4" | "9:16";
export type ImageGenerationMode = "variation" | "refine" | "angle" | "custom";

export interface ImageGenerationOptions {
  prompt: string;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  angle?: string;
  aspectRatio?: ImageAspectRatio;
  size?: string;
  mode?: ImageGenerationMode;
  apiKey?: string;
}

export interface ImageGenerationResult {
  buffer: Buffer;
  contentType: string;
}

export interface IImageGenerator {
  readonly providerName: ImageProviderName;
  generate(options: ImageGenerationOptions): Promise<ImageGenerationResult>;
}
