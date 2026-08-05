"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Next.js 16.3: this app had zero error boundaries anywhere before this —
// an uncaught exception in any dashboard route (bad Shopify/DB response, a
// real bug) used to crash to the framework's own default overlay/500 page.
// error.tsx wraps this route group and its children (dashboard/, products/,
// products/[id]/, products/new/), catching render-time exceptions. `retry`
// (this version's prop, replacing the older `reset` name) re-fetches and
// re-renders the failed segment, including its Server Components — not just
// a client-side state reset.
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 font-sans">
      <TriangleAlert className="size-10 text-destructive" />
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-section-heading font-semibold text-foreground">Something went wrong</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
      </div>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
