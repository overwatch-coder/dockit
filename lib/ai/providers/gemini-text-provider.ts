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

const GEMINI_TEXT_MODEL = "gemini-3.8-flash";

interface ImagePart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

async function fetchImagePart(url: string): Promise<ImagePart | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.split(";")[0]?.trim() || "image/jpeg";
    return {
      inlineData: {
        mimeType,
        data: buffer.toString("base64"),
      },
    };
  } catch {
    return null;
  }
}

export class GeminiTextProvider implements ITextVisionProvider {
  readonly providerName = "gemini" as const;

  async analyzePhotos(input: VisionAnalysisInput): Promise<VisionAnalysis> {
    const apiKey = input.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY for Gemini vision analysis.");
    }

    const imageParts: ImagePart[] = [];
    for (const url of input.imageUrls.slice(0, 3)) {
      const part = await fetchImagePart(url);
      if (part) imageParts.push(part);
    }

    const promptText = `You are an expert e-commerce catalog specialist and computer vision analyst.
Analyze the product photo(s) and provide an accurate, structured breakdown.

Product title: "${input.title}"
${input.description ? `Existing description context: "${input.description}"` : ""}
${imageParts.length === 0 ? "Note: No photos were available or loadable; deduce strictly from the title and context." : `Total photos provided: ${imageParts.length}.`}

Return a JSON object conforming exactly to this structure:
{
  "visualSummary": "Concise summary of what the product visually looks like, its design, and style",
  "identifiedProduct": "Specific e-commerce product name / type (e.g. 'Stainless Steel Thermal Water Bottle')",
  "materials": ["primary material", "secondary material"],
  "colors": ["predominant visual color(s)"],
  "detectedAngles": ["angles visible in the photos e.g. Front View, 45 Degree Angle"],
  "keyFeatures": ["3-5 prominent visible physical features, design elements, or construction details"],
  "targetCategoryGuess": "Best standard retail product category (e.g. 'Water Bottles', 'Coffee Mugs', 'Sneakers')",
  "recommendedPerspectives": ["Recommended alternative studio angles that would enrich this product listing"]
}`;

    const contentsParts: Array<{ text: string } | ImagePart> = [...imageParts, { text: promptText }];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: contentsParts }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini vision analysis failed (${res.status}): ${errorText.slice(0, 200)}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("No response received from Gemini vision model.");
    }

    const parsed = JSON.parse(rawText);
    return visionAnalysisSchema.parse(parsed);
  }

  async generateFields(input: ProductFieldsInput): Promise<EnrichedProductFields> {
    const apiKey = input.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY for Gemini product field generation.");
    }

    const effectiveRules = resolveEffectiveAiRules(input.rules);
    const allowedTags = DESCRIPTION_ALLOWED_TAGS.join(", ");

    const collectionsList = input.collections?.length
      ? input.collections.map((c) => `- ${c.id}: ${c.title}`).join("\n")
      : "(no collections exist in this store)";

    const promptText = `${effectiveRules.brandTone}
Using the provided vision analysis and product details, generate high-converting, professional catalog metadata.

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

CRITICAL INSTRUCTIONS & CONSTRAINTS:
1. Title: ${effectiveRules.titleRule}
2. Description: Return semantic, well-organized HTML using ONLY these tags: ${allowedTags}.
${effectiveRules.descriptionRule}
3. Category Guess: A single specific retail category name for Shopify taxonomy mapping (e.g. "Water Bottles", "Coffee Drippers", "Men's Sneakers").
4. Collection: Match the product to the single best collection from Candidate collections above by setting collectionId to that exact ID, or null if none fit.
5. Tags: ${effectiveRules.tagsRule}
6. SEO: ${effectiveRules.seoRule}
${effectiveRules.customInstructions ? `7. STORE-SPECIFIC ADAPTED RULES & CONSTRAINTS:\n${effectiveRules.customInstructions}\n` : ""}
Return JSON conforming strictly to:
{
  "title": "...",
  "descriptionHtml": "...",
  "categoryGuess": "...",
  "collectionId": "... or null",
  "tags": ["..."],
  "seoTitle": "...",
  "seoDescription": "..."
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3,
          },
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini product fields generation failed (${res.status}): ${errorText.slice(0, 200)}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("No response received from Gemini generation model.");
    }

    const parsed = JSON.parse(rawText);
    const sanitizedHtml = sanitizeDescriptionHtml(parsed.descriptionHtml || "");

    const categoryGuess = parsed.categoryGuess || input.analysis.targetCategoryGuess;
    let categoryId: string | null = null;
    let categoryFullName: string | null = null;

    if (categoryGuess) {
      const matched = resolveProductTaxonomyCategory({
        productType: categoryGuess,
        title: parsed.title || input.title,
      });
      if (matched) {
        categoryId = matched.id;
        categoryFullName = matched.fullName;
      }
    }

    const matchedCollection = input.collections?.find(
      (c) => c.id === parsed.collectionId
    );
    const collectionId = matchedCollection ? matchedCollection.id : null;
    const collectionTitle = matchedCollection ? matchedCollection.title : null;

    return enrichedProductFieldsSchema.parse({
      title: parsed.title,
      descriptionHtml: sanitizedHtml,
      categoryGuess,
      categoryId,
      categoryFullName,
      collectionId,
      collectionTitle,
      tags: parsed.tags || [],
      seoTitle: parsed.seoTitle,
      seoDescription: parsed.seoDescription,
    });
  }
}
