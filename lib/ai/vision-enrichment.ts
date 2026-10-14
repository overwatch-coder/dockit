import type {
  VisionAnalysis,
  EnrichedProductFields,
  GeneratedPerspectiveImage,
  GeneratedVariantImage,
  FullAiVisionEnrichmentResult,
} from "@/lib/validation/ai-vision-enrichment";
import { uploadGeneratedProductImage } from "@/lib/blob/products";
import type {
  TextVisionProviderName,
  ImageProviderName,
  ITextVisionProvider,
  IImageGenerator,
  PresentationStyle,
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

export async function generateVariantImages(input: {
  productId: string;
  productTitle: string;
  productDescription?: string | null;
  referenceImageUrl: string;
  variants: Array<{ id: string; optionName: string; imageUrl?: string | null }>;
  provider?: ImageProviderName;
  customGenerator?: IImageGenerator;
  apiKey?: string;
  presentationStyle?: PresentationStyle;
  referenceModelFaceUrl?: string;
  modelFaceNotes?: string;
}): Promise<GeneratedVariantImage[]> {
  const missingVariants = input.variants.filter((v) => !v.imageUrl);
  if (missingVariants.length === 0) {
    return [];
  }

  const generator = input.customGenerator || resolveImageGenerator(input.provider);

  const cleanDescription = input.productDescription
    ? input.productDescription.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)
    : "";

  let presentationDirective = "";
  if (input.presentationStyle === "on_model") {
    presentationDirective =
      "IMPORTANT MODEL & FACE FIDELITY DIRECTIVE: The apparel variant must be worn by the exact human model from the reference photo. Strictly preserve the model's exact face, facial features, facial structure, skin tone, eye shape, hairstyle, and identity with 100% photographic realism. Do NOT alter, blur, or substitute the model's face." +
      (input.modelFaceNotes ? ` Model Specifics: ${input.modelFaceNotes.trim()}.` : "");
  } else if (input.presentationStyle === "ghost_mannequin") {
    presentationDirective =
      "PRESENTATION DIRECTIVE: Professional 3D ghost mannequin / invisible mannequin photography. The clothing appears dimensional and worn by an invisible figure, with realistic fabric drape, hollow neck opening, and visible inner collar/lining.";
  } else if (input.presentationStyle === "studio_mannequin") {
    presentationDirective =
      "PRESENTATION DIRECTIVE: Displayed on a high-end minimalist matte neutral studio mannequin / tailor form, clean commercial studio lighting.";
  } else if (input.presentationStyle === "product_only") {
    presentationDirective =
      "PRESENTATION DIRECTIVE: Clean isolated studio product photography without any model, mannequin, or distracting props.";
  }

  const results = await Promise.all(
    missingVariants.map(async (variant) => {
      try {
        const prompt = [
          `Commercial studio eCommerce product photography.`,
          `Reference photo is the ground truth for product shape, build, geometry, and craftsmanship: keep the core product form identical.`,
          `Render the specific variant option: "${variant.optionName}" for product "${input.productTitle}".`,
          `Accurately reflect the distinct colorway, materials, surface finish, graphics, or styling designated by "${variant.optionName}".`,
          presentationDirective,
          cleanDescription ? `Context: ${cleanDescription}` : "",
          `Positioned in a premium studio catalog setup on a seamless pure light neutral background with soft natural contact shadows. Crisp high resolution.`,
        ]
          .filter(Boolean)
          .join(" ");

        const generated = await generator.generate({
          prompt,
          referenceImageUrl: input.referenceImageUrl,
          referenceModelFaceUrl: input.referenceModelFaceUrl,
          presentationStyle: input.presentationStyle,
          modelFaceNotes: input.modelFaceNotes,
          angle: "front_studio",
          apiKey: input.apiKey,
        });

        const filename = `ai-variant-${variant.id}-${Date.now()}.png`;
        const uploadResult = await uploadGeneratedProductImage({
          productId: input.productId,
          buffer: generated.buffer,
          filename,
        });

        if (uploadResult.success) {
          return {
            variantId: variant.id,
            optionName: variant.optionName,
            url: uploadResult.url,
            label: `Variant: ${variant.optionName}`,
          } as GeneratedVariantImage;
        }
      } catch (err) {
        console.warn(
          `Variant generation failed for "${variant.optionName}" with provider ${generator.providerName}:`,
          err
        );
      }
      return null;
    })
  );

  return results.filter((img): img is GeneratedVariantImage => img !== null);
}

export async function runFullProductAiVisionEnrichment(input: {
  productId: string;
  title: string;
  price?: string;
  description?: string | null;
  imageUrls: string[];
  variants?: Array<{ id: string; optionName: string; imageUrl?: string | null }>;
  generateImages?: boolean;
  textProvider?: TextVisionProviderName;
  imageProvider?: ImageProviderName;
  rules?: StoreAiRules;
  collections?: Collection[];
  categoryAttributes?: CategoryAttributeDefinition[];
  productMetafieldDefinitions?: ProductMetafieldDefinition[];
  apiKey?: string;
  customProvider?: ITextVisionProvider;
  customGenerator?: IImageGenerator;
}): Promise<FullAiVisionEnrichmentResult> {
  // 1. Analyze with Vision Provider (OpenAI, Gemini)
  const analysis = await analyzeProductPhotosWithVision({
    title: input.title,
    imageUrls: input.imageUrls,
    description: input.description,
    provider: input.textProvider,
    customProvider: input.customProvider,
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
    customProvider: input.customProvider,
    apiKey: input.apiKey,
  });

  // 3. Image Generation Pipeline:
  // - If product has multiple variants and some lack images: generate variant images FIRST using variant name/description
  // - If single variant or after generating missing variants: generate perspective sides of the main product image
  let generatedVariantImages: GeneratedVariantImage[] = [];
  let generatedImages: GeneratedPerspectiveImage[] = [];

  if (input.generateImages && input.imageUrls.length > 0) {
    const primaryImage = input.imageUrls[0];
    if (primaryImage) {
      const variantsList = input.variants || [];
      const missingVariantImages = variantsList.filter((v) => !v.imageUrl);

      // Multiple variants exist and at least one is missing an image
      if (variantsList.length > 1 && missingVariantImages.length > 0) {
        generatedVariantImages = await generateVariantImages({
          productId: input.productId,
          productTitle: input.title,
          productDescription: input.description,
          referenceImageUrl: primaryImage,
          variants: missingVariantImages,
          provider: input.imageProvider,
          customGenerator: input.customGenerator,
          apiKey: input.apiKey,
        });
      }

      // Generate perspective sides of the main product image
      generatedImages = await generatePerspectiveImages({
        productId: input.productId,
        referenceImageUrl: primaryImage,
        provider: input.imageProvider,
        customGenerator: input.customGenerator,
        apiKey: input.apiKey,
      });
    }
  }

  return {
    analysis,
    fields,
    generatedImages,
    generatedVariantImages,
    availableCollections: input.collections || [],
    availableCategoryAttributes: input.categoryAttributes || [],
    availableProductMetafields: input.productMetafieldDefinitions || [],
  };
}
