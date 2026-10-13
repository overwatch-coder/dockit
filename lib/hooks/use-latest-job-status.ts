"use client";

import { useEffect, useState } from "react";
import { getLatestJobStatus } from "@/app/(dashboard)/products/actions";
import type { Job } from "@/types/job";

// Ambient background polling for the header job status indicator — continuously
// checks the latest job for the active store while mounted in the persistent
// dashboard layout, picking up jobs started from any page or modal.
const POLL_INTERVAL_MS = 4000;

export function useLatestJobStatus(): { job: Job | null } {
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const result = await getLatestJobStatus();
      if (!cancelled && "job" in result) {
        setJob(result.job);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { job };
}
