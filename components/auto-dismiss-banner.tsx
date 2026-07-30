"use client";

import { useEffect, useState } from "react";

const DEFAULT_TIMEOUT_MS = 4000;

export function AutoDismissBanner({
  message,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  message: string;
  timeoutMs?: number;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs]);

  if (!visible) {
    return null;
  }

  return (
    <p className="w-full max-w-md rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
      {message}
    </p>
  );
}
