import type { ITextVisionProvider, TextVisionProviderName } from "@/lib/ai/contracts";
import { GeminiTextProvider } from "./gemini-text-provider";
import { OpenAiTextProvider } from "./openai-text-provider";

export function resolveTextVisionProvider(
  preferred?: TextVisionProviderName
): ITextVisionProvider {
  if (preferred === "openai") {
    return new OpenAiTextProvider();
  }
  if (preferred === "gemini") {
    return new GeminiTextProvider();
  }

  // Auto-detect based on available environment variables
  if (process.env.GEMINI_API_KEY) {
    return new GeminiTextProvider();
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAiTextProvider();
  }

  // Fallback default
  return new GeminiTextProvider();
}
