import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLatestJobForStore } from "@/lib/db/jobs";
import { prisma } from "@/lib/db/client";

vi.mock("@/lib/db/client", () => ({
  prisma: {
    job: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("getLatestJobForStore timeout auto-expiration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when no job exists", async () => {
    vi.mocked(prisma.job.findFirst).mockResolvedValue(null);

    const result = await getLatestJobForStore("acc-1", "store-1");
    expect(result).toBeNull();
  });

  it("returns active running job as RUNNING when less than 90 seconds old", async () => {
    const freshJob = {
      id: "job-1",
      accountId: "acc-1",
      storeId: "store-1",
      type: "SYNC" as const,
      status: "RUNNING" as const,
      results: null,
      startedAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
    };
    vi.mocked(prisma.job.findFirst).mockResolvedValue(freshJob as any);

    const result = await getLatestJobForStore("acc-1", "store-1");
    expect(result).not.toBeNull();
    expect(result?.status).toBe("RUNNING");
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it("auto-expires stale RUNNING job older than 90s to FAILED with timeout error", async () => {
    const staleDate = new Date(Date.now() - 100_000);
    const staleJob = {
      id: "job-stale-1",
      accountId: "acc-1",
      storeId: "store-1",
      type: "SYNC" as const,
      status: "RUNNING" as const,
      results: null,
      startedAt: staleDate,
      completedAt: null,
      createdAt: staleDate,
    };
    vi.mocked(prisma.job.findFirst).mockResolvedValue(staleJob as any);
    vi.mocked(prisma.job.update).mockResolvedValue({
      ...staleJob,
      status: "FAILED",
      results: { error: "Sync timed out. Shopify connection did not respond." },
      completedAt: new Date(),
    } as any);

    const result = await getLatestJobForStore("acc-1", "store-1");
    expect(result).not.toBeNull();
    expect(result?.status).toBe("FAILED");
    expect(result?.results).toEqual({
      error: "Sync timed out. Shopify connection did not respond.",
    });
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-stale-1" },
      data: expect.objectContaining({
        status: "FAILED",
        results: { error: "Sync timed out. Shopify connection did not respond." },
      }),
    });
  });

  it("auto-expires stale PENDING job older than 90s to FAILED", async () => {
    const staleDate = new Date(Date.now() - 120_000);
    const staleJob = {
      id: "job-stale-2",
      accountId: "acc-1",
      storeId: "store-1",
      type: "PUSH" as const,
      status: "PENDING" as const,
      results: null,
      startedAt: null,
      completedAt: null,
      createdAt: staleDate,
    };
    vi.mocked(prisma.job.findFirst).mockResolvedValue(staleJob as any);
    vi.mocked(prisma.job.update).mockResolvedValue({
      ...staleJob,
      status: "FAILED",
      results: { error: "push job timed out." },
      completedAt: new Date(),
    } as any);

    const result = await getLatestJobForStore("acc-1", "store-1");
    expect(result).not.toBeNull();
    expect(result?.status).toBe("FAILED");
    expect(result?.results).toEqual({ error: "push job timed out." });
  });

  it("does not auto-expire GENERATE_IMAGE job at 120s because timeout threshold is 300s", async () => {
    const runningDate = new Date(Date.now() - 120_000);
    const imageJob = {
      id: "job-img-1",
      accountId: "acc-1",
      storeId: "store-1",
      type: "GENERATE_IMAGE" as const,
      status: "RUNNING" as const,
      results: { progress: 35, stage: "Rendering..." },
      startedAt: runningDate,
      completedAt: null,
      createdAt: runningDate,
    };
    vi.mocked(prisma.job.findFirst).mockResolvedValue(imageJob as any);

    const result = await getLatestJobForStore("acc-1", "store-1");
    expect(result).not.toBeNull();
    expect(result?.status).toBe("RUNNING");
    expect(prisma.job.update).not.toHaveBeenCalled();
  });
});
