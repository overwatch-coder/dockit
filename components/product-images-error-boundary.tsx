"use client";

import { catchError, type ErrorInfo } from "next/error";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Next.js 16.3's finer-grained catchError API — distinct from a route-level
// error.tsx (app/(dashboard)/error.tsx), this wraps one component subtree so
// a bug in it degrades gracefully instead of taking the whole product editor
// down. ProductImages is the newest, most complex client-side tree in the
// editor (react-dropzone, staged-upload state, async transitions), making it
// the most likely spot for a real runtime bug to surface — the rest of
// ProductForm (title/price/description/variants/push) keeps working even if
// this boundary trips.
function ImagesErrorFallback(_props: object, { error, retry }: ErrorInfo) {
  // ErrorInfo.error is typed `unknown`, not `Error` — React error boundaries
  // can catch any thrown value (a string, an object, not just an Error
  // instance), so this narrows defensively rather than assuming `.message`
  // exists.
  const message = error instanceof Error ? error.message : "Something went wrong loading images.";
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-destructive/40 p-6 text-center">
      <TriangleAlert className="size-5 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}

export const ProductImagesErrorBoundary = catchError(ImagesErrorFallback);
