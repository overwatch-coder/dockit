import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import DOMPurify from "isomorphic-dompurify";
import {
  aiSuggestionSchema,
  productDescriptionSuggestionSchema,
  type AiSuggestion,
  type ProductDescriptionSuggestion,
} from "@/lib/validation/ai-suggestion";
import { DESCRIPTION_ALLOWED_TAGS, sanitizeDescriptionHtml } from "@/lib/sanitize-description";
import type { Collection } from "@/types/collection";

import type { StoreAiRules } from "@/lib/ai/rules";
import { resolveEffectiveAiRules } from "@/lib/ai/rules";

type SuggestionResult = { success: true; data: AiSuggestion } | { success: false; error: string };
type DescriptionResult =
  | { success: true; data: ProductDescriptionSuggestion }
  | { success: false; error: string };

// The only file that imports "ai"/"@ai-sdk/openai" — same isolation
// convention already applied to lib/shopify/ (Shopify API) and lib/blob/
// (Vercel Blob SDK).
export async function suggestProductSeo(input: {
  title: string;
  description: string | null;
  price: string;
  tags: string[];
  collections: Collection[];
  rules?: StoreAiRules;
}): Promise<SuggestionResult> {
  const effectiveRules = resolveEffectiveAiRules(input.rules);
  // The model doesn't need markup — strip it to plain text for the prompt.
  const plainDescription = input.description
    ? DOMPurify.sanitize(input.description, { ALLOWED_TAGS: [] })
    : "(no description)";

  const collectionsList = input.collections.length
    ? input.collections.map((c) => `- ${c.id}: ${c.title}`).join("\n")
    : "(no collections exist in this store)";

  const prompt = `You are helping an e-commerce store owner improve a product's search engine optimization (SEO) and organization.
${effectiveRules.brandTone}

Product:
- Title: ${input.title}
- Description: ${plainDescription}
- Price: ${input.price}
- Existing tags: ${input.tags.length ? input.tags.join(", ") : "(none)"}

Candidate collections (pick the single best match by id, or use null if none fit):
${collectionsList}

Rules & Guidelines:
- Tags: ${effectiveRules.tagsRule}
- SEO: ${effectiveRules.seoRule}
${effectiveRules.customInstructions ? `- Custom store constraints: ${effectiveRules.customInstructions}` : ""}

Write:
- seoTitle: a concise SEO title (around 60 characters) suitable for a search engine result snippet.
- seoDescription: a concise SEO description (around 155 characters) suitable for a search engine result snippet.
- tags: 3 to 8 relevant tags for this product.
- collectionId: the id of the single best-matching collection from the candidate list above, exactly as given, or null if none fit. Never invent an id that isn't in the candidate list.
- categoryGuess: a short plain-text guess of this product's real-world category (e.g. "Dog Beds", "Men's Running Shoes"), or null if you can't tell. This is just a search hint used to look up a real category afterward, not a final answer — don't invent a full breadcrumb path, just the most specific plain category name you're confident in.`;

  try {
    const { output } = await generateText({
      model: openai("gpt-4o-mini"),
      output: Output.object({ schema: aiSuggestionSchema }),
      prompt,
    });
    return { success: true, data: output };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `AI suggestion failed: ${message}` };
  }
}

// Generates a fresh description from a natural-language brief when the
// product has none yet, or rewrites/improves the existing one against
// optional custom instructions. One function handles both paths based on
// existing content presence.
export async function generateProductDescription(input: {
  title: string;
  price: string;
  existingDescriptionHtml: string | null;
  instructions: string;
  rules?: StoreAiRules;
}): Promise<DescriptionResult> {
  const effectiveRules = resolveEffectiveAiRules(input.rules);
  const allowedTags = DESCRIPTION_ALLOWED_TAGS.join(", ");
  const plainExisting = input.existingDescriptionHtml
    ? DOMPurify.sanitize(input.existingDescriptionHtml, { ALLOWED_TAGS: [] })
    : null;

  const prompt = plainExisting
    ? `You are helping an e-commerce store owner improve their product description.
${effectiveRules.brandTone}

Product title: ${input.title}
Price: ${input.price}
Current description: ${plainExisting}

Owner's instructions for the rewrite: ${input.instructions || "(none — just improve clarity, tone, and persuasiveness)"}

CRITICAL CONSTRAINTS & RULES:
1. Do NOT include the product title as an <h1>, <h2>, or top heading in the HTML output.
2. Do NOT include price, cost, currency symbols, or monetary values anywhere in the description.
3. Do NOT list product variants, SKUs, option names, or stock quantities.
4. Do NOT include hyperlinks (<a> tags) or external URLs.
5. Focus strictly on narrative product description, key features, and benefits using standard prose paragraphs and bulleted lists.
6. Description formatting rules:
${effectiveRules.descriptionRule}
${effectiveRules.customInstructions ? `7. Custom store rules: ${effectiveRules.customInstructions}` : ""}

Rewrite the description as HTML using only these tags: ${allowedTags}. Keep it well-organized (short paragraphs and/or a bullet list of key features/benefits where useful). Return only the rewritten description as descriptionHtml.`
    : `You are helping an e-commerce store owner write a product description from scratch.
${effectiveRules.brandTone}

Product title: ${input.title}
Price: ${input.price}
Owner's brief: ${input.instructions || "(none given — write a compelling general-purpose description from the title alone)"}

CRITICAL CONSTRAINTS & RULES:
1. Do NOT include the product title as an <h1>, <h2>, or top heading in the HTML output.
2. Do NOT include price, cost, currency symbols, or monetary values anywhere in the description.
3. Do NOT list product variants, SKUs, option names, or stock quantities.
4. Do NOT include hyperlinks (<a> tags) or external URLs.
5. Focus strictly on narrative product description, key features, and benefits using standard prose paragraphs and bulleted lists.
6. Description formatting rules:
${effectiveRules.descriptionRule}
${effectiveRules.customInstructions ? `7. Custom store rules: ${effectiveRules.customInstructions}` : ""}

Write the description as HTML using only these tags: ${allowedTags}. Keep it well-organized (short paragraphs and/or a bullet list of key features/benefits where useful). Return only the generated description as descriptionHtml.`;

  try {
    const { output } = await generateText({
      model: openai("gpt-4o-mini"),
      output: Output.object({ schema: productDescriptionSuggestionSchema }),
      prompt,
    });
    return { success: true, data: { descriptionHtml: sanitizeDescriptionHtml(output.descriptionHtml) } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `AI description generation failed: ${message}` };
  }
}
