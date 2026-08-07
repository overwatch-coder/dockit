import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLatestJobStatus } from "@/lib/hooks/use-latest-job-status";
import { getLatestJobStatus } from "@/app/(dashboard)/products/actions";
import type { Job } from "@/types/job";

vi.mock("@/app/(dashboard)/products/actions", () => ({
  getLatestJobStatus: vi.fn(),
}));

const mockedGetLatestJobStatus = vi.mocked(getLatestJobStatus);

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    storeId: "store-1",
    type: "PUSH",
    status: "RUNNING",
    results: null,
    startedAt: new Date(),
    completedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("useLatestJobStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedGetLatestJobStatus.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls immediately on mount, before any interval elapses", async () => {
    mockedGetLatestJobStatus.mockResolvedValue({ job: job() });

    const { result } = renderHook(() => useLatestJobStatus());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockedGetLatestJobStatus).toHaveBeenCalledTimes(1);
    expect(result.current.job?.id).toBe("job-1");
  });

  it("keeps polling indefinitely — does not stop once a job settles", async () => {
    mockedGetLatestJobStatus.mockResolvedValue({ job: job({ status: "SUCCEEDED" }) });

    renderHook(() => useLatestJobStatus());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });

    expect(mockedGetLatestJobStatus.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("reflects a null job (idle store) as null", async () => {
    mockedGetLatestJobStatus.mockResolvedValue({ job: null });

    const { result } = renderHook(() => useLatestJobStatus());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.job).toBeNull();
  });

  it("ignores an error result rather than crashing", async () => {
    mockedGetLatestJobStatus.mockResolvedValue({ error: "Not authorized" });

    const { result } = renderHook(() => useLatestJobStatus());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.job).toBeNull();
  });

  it("clears the interval on unmount", async () => {
    mockedGetLatestJobStatus.mockResolvedValue({ job: job() });

    const { unmount } = renderHook(() => useLatestJobStatus());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const callsBeforeUnmount = mockedGetLatestJobStatus.mock.calls.length;

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(mockedGetLatestJobStatus.mock.calls.length).toBe(callsBeforeUnmount);
  });
});
