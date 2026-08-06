"use client";

import { useEffect, useRef, useState } from "react";
import { getPushJobStatus } from "@/app/(dashboard)/products/actions";

type SettledStatus = "SUCCEEDED" | "FAILED" | "PARTIAL";

// Unit 16: extracted from components/product-form.tsx's original
// single-product push polling effect once a second consumer
// (components/product-table.tsx's "Push selected" action) needed the exact
// same 1500ms poll/settle loop. Only owns the interval/fetch mechanics that
// were genuinely identical between both call sites — each caller still owns
// its own status state and toast copy via onSettled/onError, so
// product-form.tsx's existing behavior (SUCCEEDED -> router.refresh() +
// "Republished/Published to Shopify"; FAILED -> results.error toast) is
// unchanged, just now driven by this hook's callbacks instead of an inline
// effect.
export function useJobPolling(options: {
  onSettled: (status: SettledStatus, results: unknown) => void;
  onError: (message: string) => void;
  intervalMs?: number;
}): { isPolling: boolean; start: (jobId: string) => void } {
  const { onSettled, onError, intervalMs = 1500 } = options;
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
      }
    }, intervalMs);
    return () => clearInterval(interval);
    // onSettled/onError are event callbacks, not reactive deps — same
    // convention as other polling effects in this codebase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPolling, intervalMs]);

  return { isPolling, start };
}
