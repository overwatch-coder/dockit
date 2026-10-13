import { describe, expect, it, vi, beforeEach } from "vitest";
import { executeImagePipeline } from "@/lib/jobs/image-gen";
import * as productDb from "@/lib/db/products";
import * as mutationDb from "@/lib/db/products/mutations";
import * as jobDb from "@/lib/db/jobs";
import * as blobProducts from "@/lib/blob/products";
import * as generatorFactory from "@/lib/ai/image/image-generator-factory";
import type { IImageGenerator } from "@/lib/ai/contracts";

describe("executeImagePipeline", () => {
  const mockProduct = {
    id: "prod_1",
    accountId: "acc_1",
    storeId: "store_1",
    title: "Eco Cotton T-Shirt",
    imageUrl: "https://example.com/original.jpg",
    imageUrls: ["https://example.com/original.jpg"],
    price: "29.99",
    status: "DRAFT" as const,
    tags: [],
    variants: [],
    collectionId: null,
    collectionTitle: null,
    categoryId: null,
    categoryFullName: null,
    seoTitle: null,
    seoDescription: null,
    lastEditedAt: new Date(),
    lastSyncedAt: null,
    isConflicted: false,
    conflictAppSnapshot: null,
    conflictShopifySnapshot: null,
    shopifyProductId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    description: "Soft organic cotton t-shirt",
  };

  const mockGenerator: IImageGenerator = {
    providerName: "gemini",
    generate: vi.fn().mockResolvedValue({
      buffer: Buffer.from("fake-image-bytes"),
      contentType: "image/png",
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(jobDb, "getJobById").mockResolvedValue({ status: "PENDING" } as any);
    vi.spyOn(jobDb, "updateJobStatus").mockResolvedValue(undefined as any);
    vi.spyOn(jobDb, "updateJobProgress").mockResolvedValue(undefined as any);
    vi.spyOn(productDb, "getProductById").mockResolvedValue(mockProduct);
    vi.spyOn(generatorFactory, "resolveImageGenerator").mockReturnValue(mockGenerator);
    vi.spyOn(blobProducts, "uploadGeneratedProductImage").mockResolvedValue({
      success: true,
      url: "https://blob.example.com/generated-1.png",
    });
    vi.spyOn(mutationDb, "appendProductImages").mockResolvedValue(mockProduct);
  });

  it("successfully generates, uploads, and appends images to product", async () => {
    const result = await executeImagePipeline({
      accountId: "acc_1",
      storeId: "store_1",
      productId: "prod_1",
      jobId: "job_1",
      prompt: "White studio background, warm lighting",
      aspectRatio: "1:1",
      mode: "variation",
      count: 1,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.generatedUrls).toEqual(["https://blob.example.com/generated-1.png"]);
    }
    expect(jobDb.updateJobStatus).toHaveBeenCalledWith({
      accountId: "acc_1",
      jobId: "job_1",
      status: "RUNNING",
    });
    expect(jobDb.updateJobStatus).toHaveBeenCalledWith({
      accountId: "acc_1",
      jobId: "job_1",
      status: "SUCCEEDED",
      results: expect.objectContaining({
        productId: "prod_1",
        success: true,
        count: 1,
      }),
    });
    expect(mutationDb.appendProductImages).toHaveBeenCalled();
  });

  it("handles missing product gracefully by marking job FAILED", async () => {
    vi.spyOn(productDb, "getProductById").mockResolvedValue(null);

    const result = await executeImagePipeline({
      accountId: "acc_1",
      storeId: "store_1",
      productId: "missing_prod",
      jobId: "job_2",
      prompt: "Clean photo",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Product no longer exists");
    }
    expect(jobDb.updateJobStatus).toHaveBeenCalledWith({
      accountId: "acc_1",
      jobId: "job_2",
      status: "FAILED",
      results: expect.objectContaining({
        productId: "missing_prod",
        success: false,
      }),
    });
  });

  it("fails job if generator throws an error", async () => {
    const failingGenerator: IImageGenerator = {
      providerName: "openai",
      generate: vi.fn().mockRejectedValue(new Error("API quota exceeded")),
    };
    vi.spyOn(generatorFactory, "resolveImageGenerator").mockReturnValue(failingGenerator);

    const result = await executeImagePipeline({
      accountId: "acc_1",
      storeId: "store_1",
      productId: "prod_1",
      jobId: "job_3",
      prompt: "Lifestyle scene",
      mode: "refine",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("API quota exceeded");
    }
    expect(jobDb.updateJobStatus).toHaveBeenCalledWith({
      accountId: "acc_1",
      jobId: "job_3",
      status: "FAILED",
      results: expect.objectContaining({
        error: "API quota exceeded",
      }),
    });
  });

  it("skips execution if job is already marked RUNNING or SUCCEEDED", async () => {
    vi.spyOn(jobDb, "getJobById").mockResolvedValue({ status: "RUNNING" } as any);

    const result = await executeImagePipeline({
      accountId: "acc_1",
      storeId: "store_1",
      productId: "prod_1",
      jobId: "job_running",
      prompt: "Studio shot",
    });

    expect(result.success).toBe(true);
    expect(jobDb.updateJobStatus).not.toHaveBeenCalled();
    expect(productDb.getProductById).not.toHaveBeenCalled();
  });
});

