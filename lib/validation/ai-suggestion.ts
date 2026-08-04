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
