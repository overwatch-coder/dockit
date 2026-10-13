import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { JobStatusIndicator, describeJobResult } from "@/components/job-status-indicator";
import { useLatestJobStatus } from "@/lib/hooks/use-latest-job-status";
import type { Job } from "@/types/job";

vi.mock("@/lib/hooks/use-latest-job-status", () => ({
  useLatestJobStatus: vi.fn(),
}));

const mockedUseLatestJobStatus = vi.mocked(useLatestJobStatus);

function baseJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    storeId: "store-1",
    type: "PUSH",
    status: "FAILED",
    results: null,
    startedAt: new Date(),
    completedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

describe("describeJobResult", () => {
  test("summarizes a batch push with items", () => {
    const job = baseJob({
      status: "PARTIAL",
      results: {
        items: [
          { productId: "p1", success: true, shopifyProductId: "s1" },
          { productId: "p2", success: false, failedStep: "shopify-push", error: "Price must be positive" },
        ],
      },
    });

    const result = describeJobResult(job);

    expect(result.summary).toBe("1 of 2 products pushed — 1 failed.");
    expect(result.items).toEqual([
      { productId: "p1", success: true, detail: undefined },
      { productId: "p2", success: false, detail: "Price must be positive" },
    ]);
  });

  test("summarizes a successful single push", () => {
    const job = baseJob({ status: "SUCCEEDED", results: { productId: "p1", shopifyProductId: "s1" } });

    const result = describeJobResult(job);

    expect(result.summary).toBe("Push succeeded.");
    expect(result.items).toEqual([{ productId: "p1", success: true, detail: undefined }]);
  });

  test("summarizes a failed single delete", () => {
    const job = baseJob({
      type: "DELETE",
      status: "FAILED",
      results: { productId: "p1", failedStep: "shopify-delete", error: "Product not found" },
    });

    const result = describeJobResult(job);

    expect(result.summary).toBe("Delete failed for one product.");
    expect(result.items).toEqual([{ productId: "p1", success: false, detail: "Product not found" }]);
  });

  test("summarizes a sync with conflicts and errors", () => {
    const job = baseJob({
      type: "SYNC",
      status: "SUCCEEDED",
      results: { syncedCount: 5, conflictedCount: 2, errorCount: 1 },
    });

    const result = describeJobResult(job);

    expect(result.summary).toBe("5 synced, 2 conflicted, 1 failed.");
    expect(result.items).toBeUndefined();
  });

  test("summarizes a sync with no conflicts or errors", () => {
    const job = baseJob({
      type: "SYNC",
      status: "SUCCEEDED",
      results: { syncedCount: 5, conflictedCount: 0, errorCount: 0 },
    });

    expect(describeJobResult(job).summary).toBe("5 synced.");
  });

  test("summarizes a store-import result", () => {
    const job = baseJob({ type: "SYNC", status: "SUCCEEDED", results: { importedCount: 12 } });

    expect(describeJobResult(job).summary).toBe("12 products imported.");
  });

  test("falls back to a plain error message for a bare-error result", () => {
    const job = baseJob({ type: "SYNC", status: "FAILED", results: { error: "Shopify connection failed" } });

    expect(describeJobResult(job).summary).toBe("Shopify connection failed");
  });

  test("falls back to a generic message for null or unrecognized results", () => {
    expect(describeJobResult(baseJob({ results: null })).summary).toBe("Something went wrong.");
    expect(describeJobResult(baseJob({ results: { weird: "shape" } })).summary).toBe("Something went wrong.");
  });
});

describe("JobStatusIndicator dismissal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedUseLatestJobStatus.mockReturnValue({ job: baseJob({ type: "SYNC", status: "SUCCEEDED" }) });
  });

  test("keeps a completed job dismissed after the header remounts, until a new job starts", () => {
    const { unmount } = render(createElement(JobStatusIndicator));

    expect(screen.getByText("Sync complete")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Sync complete")).not.toBeInTheDocument();

    unmount();
    const { rerender: rerenderAfterRemount } = render(createElement(JobStatusIndicator));
    expect(screen.queryByText("Sync complete")).not.toBeInTheDocument();

    mockedUseLatestJobStatus.mockReturnValue({ job: baseJob({ id: "job-2", type: "SYNC", status: "PENDING" }) });
    rerenderAfterRemount(createElement(JobStatusIndicator));
    expect(screen.getByText("Syncing…")).toBeInTheDocument();
  });

  test("renders running image generation job with progress percentage", () => {
    mockedUseLatestJobStatus.mockReturnValue({
      job: baseJob({
        id: "job-img-1",
        type: "GENERATE_IMAGE",
        status: "RUNNING",
        results: { progress: 35, stage: "Rendering variations…" },
      }),
    });
    render(createElement(JobStatusIndicator));
    expect(screen.getByText("Generating images… 35%")).toBeInTheDocument();
  });
});
