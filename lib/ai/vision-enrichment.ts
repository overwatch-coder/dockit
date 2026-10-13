import type {
  VisionAnalysis,
  EnrichedProductFields,
  GeneratedPerspectiveImage,
  FullAiVisionEnrichmentResult,
} from "@/lib/validation/ai-vision-enrichment";
import { uploadGeneratedProductImage } from "@/lib/blob/products";
import type {
  TextVisionProviderName,
  ImageProviderName,
  ITextVisionProvider,
  IImageGenerator,
} from "@/lib/ai/contracts";
import { resolveTextVisionProvider } from "@/lib/ai/providers/text-provider-factory";
import { resolveImageGenerator } from "@/lib/ai/image/image-generator-factory";

export const PERSPECTIVE_CONFIGS: Array<{
  angle: "side" | "angle_45" | "macro_detail";
  label: string;
  promptModifier: string;
}> = [
  {
    angle: "side",
    label: "Side Profile Studio Shot",
    promptModifier:
      "Product photo edit. The reference photo is the ground truth: keep the product EXACTLY as it is (same shape, materials, colors, logos, hardware). Show the product from a clean, exact 90-degree side profile view on a seamless pure light neutral studio background with soft natural contact shadow.",
  },
  {
    angle: "angle_45",
    label: "Hero 45° Angle Shot",
    promptModifier:
      "Product photo edit. The reference photo is the ground truth: keep the product EXACTLY as it is (same shape, materials, colors, logos, hardware). Show the product positioned at a premium 45-degree three-quarter hero angle on a seamless studio background with soft directional commercial studio lighting.",
  },
  {
    angle: "macro_detail",
    label: "Macro Detail Close-Up",
    promptModifier:
      "Product photo edit. The reference photo is the ground truth: keep the product EXACTLY as it is. Macro close-up focus on the distinctive craftsmanship, material texture, surface finish, stitching, and hardware details. Shallow depth of field, crisp razor-sharp focus.",
  },
];

export async function analyzeProductPhotosWithVision(input: {
  title: string;
  imageUrls: string[];
  description?: string | null;
  provider?: TextVisionProviderName;
  customProvider?: ITextVisionProvider;
  apiKey?: string;
}): Promise<VisionAnalysis> {
  const provider = input.customProvider || resolveTextVisionProvider(input.provider);
  return provider.analyzePhotos({
    title: input.title,
    imageUrls: input.imageUrls,
    description: input.description,
    apiKey: input.apiKey,
  });
}

import type { StoreAiRules } from "@/lib/ai/rules";
import type { Collection } from "@/types/collection";
import type {
  CategoryAttributeDefinition,
  ProductMetafieldDefinition,
} from "@/lib/shopify/metafields";

export async function generateFullProductFields(input: {
  title: string;
  price?: string;
  existingDescriptionHtml?: string | null;
  analysis: VisionAnalysis;
  rules?: StoreAiRules;
  collections?: Collection[];
  categoryAttributes?: CategoryAttributeDefinition[];
  productMetafieldDefinitions?: ProductMetafieldDefinition[];
  provider?: TextVisionProviderName;
  customProvider?: ITextVisionProvider;
  apiKey?: string;
}): Promise<EnrichedProductFields> {
  const provider = input.customProvider || resolveTextVisionProvider(input.provider);
  return provider.generateFields({
    title: input.title,
    price: input.price,
    existingDescriptionHtml: input.existingDescriptionHtml,
    analysis: input.analysis,
    rules: input.rules,
    collections: input.collections,
    categoryAttributes: input.categoryAttributes,
    productMetafieldDefinitions: input.productMetafieldDefinitions,
    apiKey: input.apiKey,
  });
}

export async function generatePerspectiveImages(input: {
  productId: string;
  referenceImageUrl: string;
  angles?: Array<"side" | "angle_45" | "macro_detail">;
  provider?: ImageProviderName;
  customGenerator?: IImageGenerator;
  apiKey?: string;
}): Promise<GeneratedPerspectiveImage[]> {
  const generator = input.customGenerator || resolveImageGenerator(input.provider);
  const targetAngles = input.angles || ["side", "angle_45", "macro_detail"];
  const configs = PERSPECTIVE_CONFIGS.filter((c) => targetAngles.includes(c.angle));

  // Run perspective generations and uploads concurrently in parallel for 3-4x speedup
  const results = await Promise.all(
    configs.map(async (config) => {
      try {
        const generated = await generator.generate({
          prompt: config.promptModifier,
          referenceImageUrl: input.referenceImageUrl,
          angle: config.angle,
          apiKey: input.apiKey,
        });

        const filename = `ai-${config.angle}-${Date.now()}.png`;
        const uploadResult = await uploadGeneratedProductImage({
          productId: input.productId,
          buffer: generated.buffer,
          filename,
        });

        if (uploadResult.success) {
          return {
            url: uploadResult.url,
            label: config.label,
            angle: config.angle,
          } as GeneratedPerspectiveImage;
        }
      } catch (err) {
        console.warn(`Perspective generation failed for angle ${config.angle} with provider ${generator.providerName}:`, err);
      }
      return null;
    })
  );

  return results.filter((img): img is GeneratedPerspectiveImage => img !== null);
}

export async function runFullProductAiVisionEnrichment(input: {
  productId: string;
  title: string;
  price?: string;
  description?: string | null;
  imageUrls: string[];
  generateImages?: boolean;
  textProvider?: TextVisionProviderName;
  imageProvider?: ImageProviderName;
  rules?: StoreAiRules;
  collections?: Collection[];
  categoryAttributes?: CategoryAttributeDefinition[];
  productMetafieldDefinitions?: ProductMetafieldDefinition[];
  apiKey?: string;
}): Promise<FullAiVisionEnrichmentResult> {
  // 1. Analyze with Vision Provider (OpenAI, Gemini)
  const analysis = await analyzeProductPhotosWithVision({
    title: input.title,
    imageUrls: input.imageUrls,
    description: input.description,
    provider: input.textProvider,
    apiKey: input.apiKey,
  });

  // 2. Generate full fields (Title, Description, Category, Tags, Collection, SEO, Metafields)
  const fields = await generateFullProductFields({
    title: input.title,
    price: input.price,
    existingDescriptionHtml: input.description,
    analysis,
    rules: input.rules,
    collections: input.collections,
    categoryAttributes: input.categoryAttributes,
    productMetafieldDefinitions: input.productMetafieldDefinitions,
    provider: input.textProvider,
    apiKey: input.apiKey,
  });

  // 3. Generate perspective angles using Image Generator in parallel
  let generatedImages: GeneratedPerspectiveImage[] = [];
  if (input.generateImages && input.imageUrls.length > 0) {
    const primaryImage = input.imageUrls[0];
    if (primaryImage) {
      generatedImages = await generatePerspectiveImages({
        productId: input.productId,
        referenceImageUrl: primaryImage,
        provider: input.imageProvider,
        apiKey: input.apiKey,
      });
    }
  }

  return {
    analysis,
    fields,
    generatedImages,
    availableCollections: input.collections || [],
    availableCategoryAttributes: input.categoryAttributes || [],
    availableProductMetafields: input.productMetafieldDefinitions || [],
  };
}
