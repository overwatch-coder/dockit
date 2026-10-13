import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { sanitizeDescriptionHtml, DESCRIPTION_ALLOWED_TAGS } from "@/lib/sanitize-description";
import {
  visionAnalysisSchema,
  enrichedProductFieldsSchema,
  type VisionAnalysis,
  type EnrichedProductFields,
} from "@/lib/validation/ai-vision-enrichment";
import { resolveProductTaxonomyCategory } from "@/lib/shopify/taxonomy";
import type { ITextVisionProvider, VisionAnalysisInput, ProductFieldsInput } from "@/lib/ai/contracts";
import { resolveEffectiveAiRules } from "@/lib/ai/rules";

export class OpenAiTextProvider implements ITextVisionProvider {
  readonly providerName = "openai" as const;

  async analyzePhotos(input: VisionAnalysisInput): Promise<VisionAnalysis> {
    const apiKey = input.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY for OpenAI vision analysis.");
    }

    const promptText = `You are an expert e-commerce catalog specialist and computer vision analyst.
Analyze the product photo(s) and provide an accurate, structured breakdown.

Product title: "${input.title}"
${input.description ? `Existing description context: "${input.description}"` : ""}
${input.imageUrls.length === 0 ? "Note: No photos were available; deduce strictly from the title and context." : `Total photos provided: ${input.imageUrls.length}.`}

Produce:
- visualSummary: Concise summary of what the product visually looks like, its design, and style
- identifiedProduct: Specific e-commerce product name / type
- materials: list of primary and secondary materials
- colors: predominant visual color(s)
- detectedAngles: angles visible in the photos
- keyFeatures: 3-5 prominent visible physical features, design elements, or construction details
- targetCategoryGuess: Best standard retail product category (e.g. 'Water Bottles', 'Coffee Mugs')
- recommendedPerspectives: Recommended alternative studio angles that would enrich this product listing`;

    const imageContentParts = input.imageUrls.slice(0, 3).map((url) => {
      try {
        return { type: "image" as const, image: new URL(url) };
      } catch {
        return null;
      }
    }).filter((part): part is { type: "image"; image: URL } => part !== null);

    const { output } = await generateText({
      model: openai("gpt-4o-mini"),
      output: Output.object({ schema: visionAnalysisSchema }),
      messages: [
        {
          role: "user",
          content: [
            ...imageContentParts,
            { type: "text", text: promptText },
          ],
        },
      ],
    });

    return output;
  }

  async generateFields(input: ProductFieldsInput): Promise<EnrichedProductFields> {
    const apiKey = input.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY for OpenAI product field generation.");
    }

    const effectiveRules = resolveEffectiveAiRules(input.rules);
    const allowedTags = DESCRIPTION_ALLOWED_TAGS.join(", ");

    const collectionsList = input.collections?.length
      ? input.collections.map((c) => `- ${c.id}: ${c.title}`).join("\n")
      : "(no collections exist in this store)";

    const catAttrsText = input.categoryAttributes?.length
      ? input.categoryAttributes
          .slice(0, 15)
          .map((a) => `- ${a.name} (${a.type}${a.choices?.length ? `: choose best from [${a.choices.slice(0, 10).join(", ")}]` : ""})`)
          .join("\n")
      : "(none available)";

    const prodMetaText = input.productMetafieldDefinitions?.length
      ? input.productMetafieldDefinitions
          .slice(0, 15)
          .map((m) => `- ${m.name} [namespace: "${m.namespace}", key: "${m.key}", type: "${m.typeName}"]: ${m.description || ""}`)
          .join("\n")
      : "(none available)";

    const promptText = `${effectiveRules.brandTone}
Using the provided vision analysis and product details, generate high-converting, professional catalog metadata and populate relevant category/product metafields.

Product Information:
- Current Title: "${input.title}"
- Price: "${input.price || "N/A"}"
- Vision Analysis Summary: "${input.analysis.visualSummary}"
- Identified Product: "${input.analysis.identifiedProduct}"
- Materials: ${input.analysis.materials.join(", ") || "N/A"}
- Colors: ${input.analysis.colors.join(", ") || "N/A"}
- Key Visual Features: ${input.analysis.keyFeatures.join("; ") || "N/A"}
- Category Guess: "${input.analysis.targetCategoryGuess || "N/A"}"

Candidate collections (pick the single best match by id, or null if none fit):
${collectionsList}

Available Category Metafields (select suitable values based on imagery/product details):
${catAttrsText}

Available Product Metafields (generate realistic values if applicable):
${prodMetaText}

CRITICAL INSTRUCTIONS & CONSTRAINTS:
1. Title: ${effectiveRules.titleRule}
2. Description: Return semantic, well-organized HTML using ONLY these tags: ${allowedTags}.
${effectiveRules.descriptionRule}
3. Category Guess: A single specific retail category name for Shopify taxonomy mapping (e.g. "Water Bottles", "Coffee Drippers", "Men's Sneakers").
4. Collection: Match the product to the single best collection from Candidate collections above by setting collectionId to that exact ID, or null if none fit.
5. Metafields: Generate relevant category and product metafield values based on visual analysis and context.
   - For choice attributes (like Color, Target gender, Snowboarding style, etc.), select one of the allowed choices if listed.
   - For text or measurement inputs (like Snowboard length, Snowboard binding mount), generate an accurate, realistic value (e.g. "156 cm", "4x4 / 2x4 Universal").
6. Tags: ${effectiveRules.tagsRule}
7. SEO: ${effectiveRules.seoRule}
${effectiveRules.customInstructions ? `8. STORE-SPECIFIC ADAPTED RULES & CONSTRAINTS:\n${effectiveRules.customInstructions}` : ""}`;

    const { output } = await generateText({
      model: openai("gpt-4o-mini"),
      output: Output.object({ schema: enrichedProductFieldsSchema }),
      prompt: promptText,
    });

    const sanitizedHtml = sanitizeDescriptionHtml(output.descriptionHtml || "");

    const categoryGuess = output.categoryGuess || input.analysis.targetCategoryGuess;
    let categoryId: string | null = null;
    let categoryFullName: string | null = null;

    if (categoryGuess) {
      const matched = resolveProductTaxonomyCategory({
        productType: categoryGuess,
        title: output.title || input.title,
      });
      if (matched) {
        categoryId = matched.id;
        categoryFullName = matched.fullName;
      }
    }

    const matchedCollection = input.collections?.find(
      (c) => c.id === output.collectionId
    );
    const collectionId = matchedCollection ? matchedCollection.id : null;
    const collectionTitle = matchedCollection ? matchedCollection.title : null;

    return {
      title: output.title,
      descriptionHtml: sanitizedHtml,
      categoryGuess,
      categoryId,
      categoryFullName,
      collectionId,
      collectionTitle,
      tags: output.tags || [],
      seoTitle: output.seoTitle,
      seoDescription: output.seoDescription,
      metafields: output.metafields || [],
    };
  }
}
