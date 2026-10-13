import type { IImageGenerator, ImageGenerationOptions, ImageGenerationResult } from "@/lib/ai/contracts";

const KIE_API_URL = "https://api.kie.ai";

export class KieImageGenerator implements IImageGenerator {
  readonly providerName = "kie" as const;

  async generate(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const apiKey = options.apiKey || process.env.KIE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing KIE_API_KEY for Kie.ai image generation.");
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // 1. Create task on Kie
    const prompt = `${options.prompt} Professional commercial product photography, neutral studio background, 4k.`;
    const taskInput = {
      prompt,
      image_input: options.referenceImageUrl ? [options.referenceImageUrl] : [],
      aspect_ratio: options.aspectRatio || "1:1",
      output_format: "png",
    };

    const createRes = await fetch(`${KIE_API_URL}/api/v1/jobs/createTask`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "nano-banana-pro",
        input: taskInput,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Kie.ai createTask failed (${createRes.status}): ${errText.slice(0, 200)}`);
    }

    const createData = await createRes.json();
    const taskId = createData.data?.taskId || createData.taskId;
    if (!taskId) {
      throw new Error(`Kie.ai did not return a taskId: ${JSON.stringify(createData)}`);
    }

    // 2. Poll task status (up to 30 seconds, 2-second intervals)
    let resultUrl: string | null = null;
    const maxAttempts = 15;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const pollRes = await fetch(
        `${KIE_API_URL}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
        { headers, signal: AbortSignal.timeout(10000) }
      );

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      const state = pollData.data?.state || pollData.state;

      if (state === "success") {
        resultUrl = pollData.data?.resultUrl || pollData.resultUrl || pollData.data?.outputUrl;
        break;
      }

      if (state === "fail") {
        const failMsg = pollData.data?.failMsg || pollData.failMsg || "Task failed";
        throw new Error(`Kie.ai task failed: ${failMsg}`);
      }
    }

    if (!resultUrl) {
      throw new Error("Kie.ai task timed out before completing.");
    }

    // 3. Download the result image bytes
    const downloadRes = await fetch(resultUrl, { signal: AbortSignal.timeout(15000) });
    if (!downloadRes.ok) {
      throw new Error(`Failed to download Kie.ai image result (${downloadRes.status})`);
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = downloadRes.headers.get("content-type") || "image/png";

    return {
      buffer,
      contentType,
    };
  }
}
