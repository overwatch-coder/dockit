import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import DOMPurify from "isomorphic-dompurify";
import { aiSuggestionSchema, type AiSuggestion } from "@/lib/validation/ai-suggestion";
import type { Collection } from "@/types/collection";

type SuggestionResult = { success: true; data: AiSuggestion } | { success: false; error: string };

// The only file that imports "ai"/"@ai-sdk/openai" — same isolation
// convention already applied to lib/shopify/ (Shopify API) and lib/blob/
// (Vercel Blob SDK).
export async function suggestProductSeo(input: {
  title: string;
  description: string | null;
  price: string;
  tags: string[];
  collections: Collection[];
}): Promise<SuggestionResult> {
  // The model doesn't need markup — strip it to plain text for the prompt.
  const plainDescription = input.description
    ? DOMPurify.sanitize(input.description, { ALLOWED_TAGS: [] })
    : "(no description)";

  const collectionsList = input.collections.length
    ? input.collections.map((c) => `- ${c.id}: ${c.title}`).join("\n")
    : "(no collections exist in this store)";

  const prompt = `You are helping an e-commerce store owner improve a product's search engine optimization (SEO) and organization.

Product:
- Title: ${input.title}
- Description: ${plainDescription}
- Price: ${input.price}
- Existing tags: ${input.tags.length ? input.tags.join(", ") : "(none)"}

Candidate collections (pick the single best match by id, or use null if none fit):
${collectionsList}

Write:
- seoTitle: a concise SEO title (around 60 characters) suitable for a search engine result snippet.
- seoDescription: a concise SEO description (around 155 characters) suitable for a search engine result snippet.
- tags: 3 to 8 relevant tags for this product.
- collectionId: the id of the single best-matching collection from the candidate list above, exactly as given, or null if none fit. Never invent an id that isn't in the candidate list.`;

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
