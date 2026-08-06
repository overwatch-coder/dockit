import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJobPolling } from "@/lib/hooks/use-job-polling";
import { getPushJobStatus } from "@/app/(dashboard)/products/actions";

vi.mock("@/app/(dashboard)/products/actions", () => ({
  getPushJobStatus: vi.fn(),
}));

const mockedGetPushJobStatus = vi.mocked(getPushJobStatus);

describe("useJobPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedGetPushJobStatus.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not poll before start() is called", () => {
    renderHook(() => useJobPolling({ onSettled: vi.fn(), onError: vi.fn() }));
    vi.advanceTimersByTime(5000);
    expect(mockedGetPushJobStatus).not.toHaveBeenCalled();
  });

  it("stops polling and calls onSettled once the job reaches SUCCEEDED", async () => {
    mockedGetPushJobStatus.mockResolvedValue({ status: "SUCCEEDED", results: { productId: "1" } });
    const onSettled = vi.fn();
    const { result } = renderHook(() => useJobPolling({ onSettled, onError: vi.fn(), intervalMs: 1000 }));

    act(() => result.current.start("job-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(onSettled).toHaveBeenCalledWith("SUCCEEDED", { productId: "1" });
    expect(result.current.isPolling).toBe(false);

    mockedGetPushJobStatus.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(mockedGetPushJobStatus).not.toHaveBeenCalled();
  });

  it("stops polling and calls onSettled with PARTIAL", async () => {
    mockedGetPushJobStatus.mockResolvedValue({ status: "PARTIAL", results: { items: [] } });
    const onSettled = vi.fn();
    const { result } = renderHook(() => useJobPolling({ onSettled, onError: vi.fn(), intervalMs: 1000 }));

    act(() => result.current.start("job-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(onSettled).toHaveBeenCalledWith("PARTIAL", { items: [] });
  });

  it("stops polling and calls onError when the job lookup errors", async () => {
    mockedGetPushJobStatus.mockResolvedValue({ error: "Job not found." });
    const onError = vi.fn();
    const { result } = renderHook(() => useJobPolling({ onSettled: vi.fn(), onError, intervalMs: 1000 }));

    act(() => result.current.start("missing-job"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(onError).toHaveBeenCalledWith("Job not found.");
    expect(result.current.isPolling).toBe(false);
  });

  it("keeps polling (no callback fires) while the job is still RUNNING", async () => {
    mockedGetPushJobStatus.mockResolvedValue({ status: "RUNNING", results: null });
    const onSettled = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useJobPolling({ onSettled, onError, intervalMs: 1000 }));

    act(() => result.current.start("job-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(onSettled).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.isPolling).toBe(true);
    expect(mockedGetPushJobStatus.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("clears the interval on unmount", async () => {
    mockedGetPushJobStatus.mockResolvedValue({ status: "RUNNING", results: null });
    const { result, unmount } = renderHook(() => useJobPolling({ onSettled: vi.fn(), onError: vi.fn(), intervalMs: 1000 }));

    act(() => result.current.start("job-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const callsBeforeUnmount = mockedGetPushJobStatus.mock.calls.length;

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mockedGetPushJobStatus.mock.calls.length).toBe(callsBeforeUnmount);
  });
});
