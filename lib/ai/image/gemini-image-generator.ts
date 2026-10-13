import type { IImageGenerator, ImageGenerationOptions, ImageGenerationResult } from "@/lib/ai/contracts";

const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

async function fetchImagePart(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.split(";")[0]?.trim() || "image/jpeg";
    return {
      mimeType,
      data: buffer.toString("base64"),
    };
  } catch {
    return null;
  }
}

export class GeminiImageGenerator implements IImageGenerator {
  readonly providerName = "gemini" as const;

  async generate(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY for Gemini image generation.");
    }

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    if (options.referenceImageUrl) {
      const referencePart = await fetchImagePart(options.referenceImageUrl);
      if (referencePart) {
        parts.push({ inlineData: referencePart });
      }
    }

    const aspectPrompt = options.aspectRatio ? ` Aspect ratio: ${options.aspectRatio}.` : "";
    const sizePrompt = options.size ? ` Target dimensions: ${options.size}.` : "";

    parts.push({
      text: `${options.prompt}.${aspectPrompt}${sizePrompt} High resolution, photorealistic, clean studio commercial photography. No added text or watermarks.`,
    });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini image generation failed (${res.status}): ${errorText.slice(0, 200)}`);
    }

    const data = await res.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data?: string; mimeType?: string } }) => Boolean(p.inlineData?.data)
    );

    if (!imagePart?.inlineData?.data) {
      throw new Error("No image data returned from Gemini.");
    }

    const buffer = Buffer.from(imagePart.inlineData.data, "base64");
    const contentType = imagePart.inlineData.mimeType || "image/png";

    return {
      buffer,
      contentType,
    };
  }
}
