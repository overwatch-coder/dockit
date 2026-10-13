import type { IImageGenerator, ImageProviderName } from "@/lib/ai/contracts";
import { GeminiImageGenerator } from "./gemini-image-generator";
import { OpenAiImageGenerator } from "./openai-image-generator";
import { KieImageGenerator } from "./kie-image-generator";

export function resolveImageGenerator(
  preferred?: ImageProviderName
): IImageGenerator {
  if (preferred === "kie") {
    return new KieImageGenerator();
  }
  if (preferred === "openai") {
    return new OpenAiImageGenerator();
  }
  if (preferred === "gemini") {
    return new GeminiImageGenerator();
  }

  // Auto-detect based on configured environment keys: prioritize fast direct generators
  if (process.env.GEMINI_API_KEY) {
    return new GeminiImageGenerator();
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAiImageGenerator();
  }
  if (process.env.KIE_API_KEY) {
    return new KieImageGenerator();
  }

  return new GeminiImageGenerator();
}
