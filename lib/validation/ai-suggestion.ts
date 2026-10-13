import { z } from "zod";

// The structured shape requested from the model in lib/ai/suggestions.ts
// (passed directly as the AI SDK's Output.object schema) — this schema
// doubles as both the model's structured-output contract and the validation
// contract, so there's no separate parse step after the call returns.
export const aiSuggestionSchema = z.object({
  seoTitle: z.string().trim().min(1),
  seoDescription: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)).max(20),
  collectionId: z.string().trim().nullable(),
  // A plain-text guess ("Dog Beds"), not an id — the model is never shown
  // Shopify's real ~10,000-category taxonomy, so this is only a search hint
  // the server resolves against the real taxonomy afterward (see
  // suggestProductSeo in app/(dashboard)/products/actions.ts).
  categoryGuess: z.string().trim().nullable(),
});

export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;

// Structured output contract for lib/ai/suggestions.ts's generateProductDescription —
// a single HTML field, restricted server-side (sanitizeDescriptionHtml) to the same
// allowlist the rich text editor's toolbar is limited to (architecture.md invariant 7:
// never auto-written, only returned as a suggestion for review before Save).
export const productDescriptionSuggestionSchema = z.object({
  descriptionHtml: z.string().trim().min(1),
});

export type ProductDescriptionSuggestion = z.infer<typeof productDescriptionSuggestionSchema>;
