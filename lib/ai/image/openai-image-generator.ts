import type { IImageGenerator, ImageGenerationOptions, ImageGenerationResult } from "@/lib/ai/contracts";

export class OpenAiImageGenerator implements IImageGenerator {
  readonly providerName = "openai" as const;

  async generate(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY for OpenAI image generation.");
    }

    const enhancedPrompt = `${options.prompt} Professional commercial product photography, pure clean studio background, crisp details, 8k resolution, no watermarks, no added text.`;

    const sizeMap: Record<string, "1024x1024" | "1792x1024" | "1024x1792"> = {
      "1:1": "1024x1024",
      "16:9": "1792x1024",
      "4:3": "1792x1024",
      "9:16": "1024x1792",
      "3:4": "1024x1792",
    };

    let targetSize: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024";
    if (options.size && ["1024x1024", "1792x1024", "1024x1792"].includes(options.size)) {
      targetSize = options.size as "1024x1024" | "1792x1024" | "1024x1792";
    } else if (options.aspectRatio && sizeMap[options.aspectRatio]) {
      targetSize = sizeMap[options.aspectRatio];
    }

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: enhancedPrompt.slice(0, 1000),
        n: 1,
        size: targetSize,
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(35000),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI image generation failed (${res.status}): ${errorText.slice(0, 200)}`);
    }

    const data = await res.json();
    const b64Json = data.data?.[0]?.b64_json;
    if (!b64Json) {
      throw new Error("No b64_json image returned from OpenAI.");
    }

    const buffer = Buffer.from(b64Json, "base64");
    return {
      buffer,
      contentType: "image/png",
    };
  }
}
