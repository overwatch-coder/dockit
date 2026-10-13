import { inngest } from "@/lib/jobs/client";
import { getJobById, updateJobStatus, updateJobProgress } from "@/lib/db/jobs";
import { getProductById } from "@/lib/db/products";
import { appendProductImages } from "@/lib/db/products/mutations";
import { uploadGeneratedProductImage } from "@/lib/blob/products";
import { resolveImageGenerator } from "@/lib/ai/image/image-generator-factory";
import type { ImageProviderName, ImageAspectRatio, ImageGenerationMode } from "@/lib/ai/contracts";

export interface ImageGenerationJobPayload {
  accountId: string;
  storeId: string;
  productId: string;
  jobId: string;
  prompt: string;
  referenceImageUrl?: string | null;
  aspectRatio?: ImageAspectRatio;
  size?: string;
  mode?: ImageGenerationMode;
  provider?: ImageProviderName;
  count?: number; // 1 to 3
}

export type ImagePipelineExecutionResult =
  | { success: true; generatedUrls: string[] }
  | { success: false; error: string };

export async function executeImagePipeline(
  payload: ImageGenerationJobPayload
): Promise<ImagePipelineExecutionResult> {
  const {
    accountId,
    productId,
    jobId,
    prompt,
    referenceImageUrl,
    aspectRatio = "1:1",
    size,
    mode = "variation",
    provider,
    count = 1,
  } = payload;

  try {
    // Check if job is already RUNNING or SUCCEEDED to prevent double execution
    const existingJob = await getJobById(accountId, jobId);
    if (existingJob && (existingJob.status === "RUNNING" || existingJob.status === "SUCCEEDED")) {
      return { success: true, generatedUrls: [] };
    }

    await updateJobStatus({ accountId, jobId, status: "RUNNING" });
    await updateJobProgress({
      accountId,
      jobId,
      progress: 15,
      stage: "Analyzing reference details & composing scene directives…",
      total: count,
    });

    const product = await getProductById(accountId, productId);
    if (!product) {
      throw new Error("Product no longer exists.");
    }

    const generator = resolveImageGenerator(provider);

    // Build rich, mode-specific prompt
    let modeInstruction = "";
    if (mode === "refine") {
      modeInstruction =
        "Enhance and refine the existing product details, crisp surface textures, perfect commercial studio lighting, ultra clean background, and sharp focal clarity.";
    } else if (mode === "angle") {
      modeInstruction =
        "Generate an alternative dynamic commercial perspective/angle of this product, maintaining exact brand colors, silhouette, materials, and features.";
    } else if (mode === "variation") {
      modeInstruction =
        "Generate a creative aesthetic variation of this product presented in a high-end commercial studio catalog setup.";
    } else {
      modeInstruction = "Professional commercial studio product photography.";
    }

    const finalPrompt = [
      `Product: ${product.title}.`,
      prompt ? `Specific Direction: ${prompt.trim()}.` : "",
      modeInstruction,
    ]
      .filter(Boolean)
      .join(" ");

    const numImages = Math.min(Math.max(count || 1, 1), 3);

    // Reference image priority: explicitly selected reference, or existing product image
    const effectiveReferenceUrl =
      referenceImageUrl !== undefined
        ? referenceImageUrl
        : product.imageUrl || (product.imageUrls.length > 0 ? product.imageUrls[0] : null);

    await updateJobProgress({
      accountId,
      jobId,
      progress: 35,
      stage: `Rendering ${numImages} ${mode} variation${numImages > 1 ? "s" : ""} with studio lighting…`,
      total: numImages,
    });

    // Run generations and uploads concurrently in parallel to prevent compounding delays
    const generateAndUploadOne = async (index: number): Promise<string> => {
      const variationPrompt =
        numImages > 1
          ? `${finalPrompt} (Alternative shot variation #${index + 1})`
          : finalPrompt;

      const genResult = await generator.generate({
        prompt: variationPrompt,
        referenceImageUrl: effectiveReferenceUrl ?? undefined,
        aspectRatio,
        size,
        mode,
      });

      const uploadResult = await uploadGeneratedProductImage({
        productId,
        buffer: genResult.buffer,
        filename: `ai-${mode}-${index + 1}-${crypto.randomUUID().slice(0, 8)}.png`,
      });

      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }

      return uploadResult.url;
    };

    const generatedUrls = await Promise.all(
      Array.from({ length: numImages }, (_, idx) => generateAndUploadOne(idx))
    );

    await updateJobProgress({
      accountId,
      jobId,
      progress: 85,
      stage: "Saving high-resolution media & updating product gallery…",
      total: numImages,
    });

    // Persist new images onto Product record in Postgres
    await appendProductImages({
      accountId,
      productId,
      urls: generatedUrls,
    });

    await updateJobProgress({
      accountId,
      jobId,
      progress: 100,
      stage: "Generation complete!",
      total: numImages,
    });

    await updateJobStatus({
      accountId,
      jobId,
      status: "SUCCEEDED",
      results: {
        productId,
        success: true,
        generatedUrls,
        count: generatedUrls.length,
        progress: 100,
        stage: "Generation complete!",
      },
    });

    return { success: true, generatedUrls };
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Image generation pipeline encountered an error.";

    await updateJobStatus({
      accountId,
      jobId,
      status: "FAILED",
      results: {
        productId,
        success: false,
        error: errorMsg,
      },
    });

    return { success: false, error: errorMsg };
  }
}

export async function triggerImageGenerationJob(
  payload: ImageGenerationJobPayload
): Promise<void> {
  try {
    await inngest.send({
      name: "product/image-generate.requested",
      data: payload,
    });
  } catch (err) {
    // Fail-open: If Inngest is not running (dev without inngest-cli or worker unavailable),
    // execute immediately in the background asynchronously so the job completes reliably!
    console.warn("[image-gen] inngest.send failed, running in-process fallback:", err);
    void executeImagePipeline(payload);
    return;
  }

  // Safety net in dev: If Inngest dev server is running but misrouted or functions not synced,
  // ensure the job starts after 3.5s so merchants are never stuck in PENDING indefinitely.
  if (process.env.NODE_ENV !== "production") {
    setTimeout(async () => {
      try {
        const job = await getJobById(payload.accountId, payload.jobId);
        if (job && job.status === "PENDING") {
          console.warn(`[image-gen] Job ${payload.jobId} still PENDING after 3.5s in dev; running in-process fallback.`);
          void executeImagePipeline(payload);
        }
      } catch {
        // Ignore safety check error
      }
    }, 3500);
  }
}

export const generateProductImageJob = inngest.createFunction(
  { id: "generate-product-image", triggers: { event: "product/image-generate.requested" } },
  async ({ event, step }) => {
    const payload = event.data as ImageGenerationJobPayload;
    return await step.run("execute-image-pipeline", () => executeImagePipeline(payload));
  }
);
