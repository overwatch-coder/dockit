"use client";

import { useEffect, useState } from "react";
import { getLatestJobStatus } from "@/app/(dashboard)/products/actions";
import type { Job } from "@/types/job";

// Unit 20: the job status indicator's polling — deliberately not
// lib/hooks/use-job-polling.ts's shape (poll a known jobId until it settles,
// then stop). This has the opposite job: continuously ask "what's the
// latest job right now" for as long as the indicator is mounted (always,
// since it lives in the persistent dashboard layout), so a job started from
// anywhere else in the app is picked up without needing to be the component
// that triggered it. Slower than the 1500ms "I'm actively waiting on this"
// interval those hooks use, since this is ambient background awareness, not
// a foreground wait.
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
