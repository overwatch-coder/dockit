import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolveTextVisionProvider } from "@/lib/ai/providers/text-provider-factory";
import { resolveImageGenerator } from "@/lib/ai/image/image-generator-factory";
import { GeminiTextProvider } from "@/lib/ai/providers/gemini-text-provider";
import { OpenAiTextProvider } from "@/lib/ai/providers/openai-text-provider";
import { GeminiImageGenerator } from "@/lib/ai/image/gemini-image-generator";
import { OpenAiImageGenerator } from "@/lib/ai/image/openai-image-generator";
import { KieImageGenerator } from "@/lib/ai/image/kie-image-generator";

describe("AI Provider Factories", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.KIE_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("resolveTextVisionProvider", () => {
    it("returns OpenAiTextProvider when preferred is openai", () => {
      const provider = resolveTextVisionProvider("openai");
      expect(provider).toBeInstanceOf(OpenAiTextProvider);
      expect(provider.providerName).toBe("openai");
    });

    it("returns GeminiTextProvider when preferred is gemini", () => {
      const provider = resolveTextVisionProvider("gemini");
      expect(provider).toBeInstanceOf(GeminiTextProvider);
      expect(provider.providerName).toBe("gemini");
    });

    it("auto-detects Gemini when GEMINI_API_KEY is present", () => {
      process.env.GEMINI_API_KEY = "mock-gemini-key";
      const provider = resolveTextVisionProvider();
      expect(provider).toBeInstanceOf(GeminiTextProvider);
    });

    it("auto-detects OpenAI when only OPENAI_API_KEY is present", () => {
      process.env.OPENAI_API_KEY = "mock-openai-key";
      const provider = resolveTextVisionProvider();
      expect(provider).toBeInstanceOf(OpenAiTextProvider);
    });

    it("defaults to GeminiTextProvider when no keys are configured", () => {
      const provider = resolveTextVisionProvider();
      expect(provider).toBeInstanceOf(GeminiTextProvider);
    });
  });

  describe("resolveImageGenerator", () => {
    it("returns KieImageGenerator when preferred is kie", () => {
      const generator = resolveImageGenerator("kie");
      expect(generator).toBeInstanceOf(KieImageGenerator);
      expect(generator.providerName).toBe("kie");
    });

    it("returns OpenAiImageGenerator when preferred is openai", () => {
      const generator = resolveImageGenerator("openai");
      expect(generator).toBeInstanceOf(OpenAiImageGenerator);
      expect(generator.providerName).toBe("openai");
    });

    it("returns GeminiImageGenerator when preferred is gemini", () => {
      const generator = resolveImageGenerator("gemini");
      expect(generator).toBeInstanceOf(GeminiImageGenerator);
      expect(generator.providerName).toBe("gemini");
    });

    it("auto-detects Kie when KIE_API_KEY is set", () => {
      process.env.KIE_API_KEY = "mock-kie-key";
      const generator = resolveImageGenerator();
      expect(generator).toBeInstanceOf(KieImageGenerator);
    });

    it("auto-detects Gemini when GEMINI_API_KEY is set and no Kie key", () => {
      process.env.GEMINI_API_KEY = "mock-gemini-key";
      const generator = resolveImageGenerator();
      expect(generator).toBeInstanceOf(GeminiImageGenerator);
    });

    it("auto-detects OpenAI when only OPENAI_API_KEY is set", () => {
      process.env.OPENAI_API_KEY = "mock-openai-key";
      const generator = resolveImageGenerator();
      expect(generator).toBeInstanceOf(OpenAiImageGenerator);
    });

    it("defaults to GeminiImageGenerator when no keys are set", () => {
      const generator = resolveImageGenerator();
      expect(generator).toBeInstanceOf(GeminiImageGenerator);
    });
  });
});
