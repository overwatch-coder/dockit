import { z } from "zod";

// Unit 14: the structured shape requested from the model in lib/ai/suggestions.ts
// (passed directly as the AI SDK's Output.object schema) — this one schema
// doubles as both the model's structured-output contract and the validation
// contract, so there's no separate parse step after the call returns.
export const aiSuggestionSchema = z.object({
  seoTitle: z.string().trim().min(1),
  seoDescription: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)).max(20),
  collectionId: z.string().trim().nullable(),
});

export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;

// Unit 16: structured output contract for lib/ai/suggestions.ts's
// generateProductDescription — a single HTML field, restricted server-side
// (sanitizeDescriptionHtml) to the same allowlist the rich text editor's own
// toolbar is limited to, same as every other AI-generated field in this app
// (architecture.md invariant 7: never auto-written, only ever returned as a
// suggestion for the owner to review before Save).
export const productDescriptionSuggestionSchema = z.object({
  descriptionHtml: z.string().trim().min(1),
});

export type ProductDescriptionSuggestion = z.infer<typeof productDescriptionSuggestionSchema>;
