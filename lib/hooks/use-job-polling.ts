"use client";

import { useEffect, useRef, useState } from "react";
import { getPushJobStatus } from "@/app/(dashboard)/products/actions";

type SettledStatus = "SUCCEEDED" | "FAILED" | "PARTIAL";

// Reusable job polling effect used by product-form, product-table, and modal dialogs
// to poll background jobs every 1500ms until settled. Manages the interval/fetch
// lifecycle while callers receive lifecycle notifications via onSettled/onError/onProgress.
export function useJobPolling(options: {
  onSettled: (status: SettledStatus, results: unknown) => void;
  onError: (message: string) => void;
  onProgress?: (results: unknown) => void;
  intervalMs?: number;
}): { isPolling: boolean; start: (jobId: string) => void } {
  const { onSettled, onError, onProgress, intervalMs = 1500 } = options;
  const [isPolling, setIsPolling] = useState(false);
  const jobIdRef = useRef<string | null>(null);

  function start(jobId: string) {
    jobIdRef.current = jobId;
    setIsPolling(true);
  }

  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(async () => {
      const jobId = jobIdRef.current;
      if (!jobId) return;
      const result = await getPushJobStatus(jobId);
      if ("error" in result) {
        clearInterval(interval);
        setIsPolling(false);
        onError(result.error);
        return;
      }
      if (result.status === "SUCCEEDED" || result.status === "FAILED" || result.status === "PARTIAL") {
        clearInterval(interval);
        setIsPolling(false);
        onSettled(result.status, result.results);
      } else {
        onProgress?.(result.results);
      }
    }, intervalMs);
    return () => clearInterval(interval);
    // onSettled/onError are event callbacks, not reactive deps — same
    // convention as other polling effects in this codebase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPolling, intervalMs]);

  return { isPolling, start };
}
