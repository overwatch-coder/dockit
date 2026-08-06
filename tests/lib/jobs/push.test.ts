import { describe, expect, it } from "vitest";
import { computeBatchJobStatus } from "@/lib/jobs/push";
import type { PushBatchResultItem } from "@/types/job";

function succeeded(productId: string): PushBatchResultItem {
  return { productId, success: true, shopifyProductId: `gid://shopify/Product/${productId}` };
}

function failed(productId: string): PushBatchResultItem {
  return { productId, success: false, failedStep: "shopify-push", error: "Something went wrong" };
}

describe("computeBatchJobStatus", () => {
  it("returns SUCCEEDED when every item succeeded", () => {
    expect(computeBatchJobStatus([succeeded("1"), succeeded("2"), succeeded("3")])).toBe("SUCCEEDED");
  });

  it("returns FAILED when every item failed", () => {
    expect(computeBatchJobStatus([failed("1"), failed("2")])).toBe("FAILED");
  });

  it("returns PARTIAL when some items succeeded and some failed", () => {
    expect(computeBatchJobStatus([succeeded("1"), failed("2"), succeeded("3")])).toBe("PARTIAL");
  });

  it("returns SUCCEEDED for a single successful item (batch of one)", () => {
    expect(computeBatchJobStatus([succeeded("1")])).toBe("SUCCEEDED");
  });

  it("returns FAILED for a single failed item (batch of one)", () => {
    expect(computeBatchJobStatus([failed("1")])).toBe("FAILED");
  });
});
