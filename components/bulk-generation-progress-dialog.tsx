"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ImageOff,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shopifyThumbnailUrl } from "@/lib/shopify/image-url";

export type BulkGenerationProgressItem = {
  id: string;
  title: string;
  imageUrl?: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  stepDescription?: string;
  error?: string;
};

interface BulkGenerationProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BulkGenerationProgressItem[];
  mode: "content-and-images" | "content-only";
  currentIndex: number;
  isComplete: boolean;
  onClose: () => void;
}

export function BulkGenerationProgressDialog({
  open,
  onOpenChange,
  items,
  mode,
  currentIndex,
  isComplete,
  onClose,
}: BulkGenerationProgressDialogProps) {
  const completedCount = items.filter(
    (i) => i.status === "completed" || i.status === "failed",
  ).length;
  const percentage =
    items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
  const activeItem = items[currentIndex];

  return (
    <Dialog open={open} onOpenChange={(val) => !isComplete ? null : onOpenChange(val)}>
      <DialogContent className="sm:max-w-xl max-w-[calc(100%-1.5rem)] p-5 sm:p-6" showCloseButton={isComplete}>
        <DialogHeader className="gap-1.5">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              {mode === "content-and-images" ? (
                <Wand2 className="size-4.5" />
              ) : (
                <Sparkles className="size-4.5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-semibold">
                {mode === "content-and-images"
                  ? "Generating Images & Content"
                  : "Generating Content with AI Vision"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isComplete
                  ? `Completed processing ${items.length} product${items.length === 1 ? "" : "s"}`
                  : `Enriching catalog fields ${mode === "content-and-images" ? "and generating studio photography" : "using vision analysis"}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Progress Bar & Counter */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completedCount} of {items.length} completed
            </span>
            <span className="font-mono font-medium text-foreground">
              {percentage}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Active Processing Callout */}
        {!isComplete && activeItem && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-3">
            <div className="size-10 rounded shrink-0 overflow-hidden border border-border bg-muted flex items-center justify-center">
              {activeItem.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shopifyThumbnailUrl(activeItem.imageUrl, 80)}
                  alt={activeItem.title}
                  className="size-full object-cover"
                />
              ) : (
                <ImageOff className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground truncate">
                  {activeItem.title}
                </p>
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 border-primary/40 bg-primary/10 text-primary font-mono shrink-0"
                >
                  Step {currentIndex + 1}/{items.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                <Loader2 className="size-3 animate-spin text-primary shrink-0" />
                <span className="truncate">
                  {activeItem.stepDescription ||
                    "Analyzing images, writing description & predicting metafields..."}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Item Queue List */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Queue Progression</p>
          <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border/60">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-2.5 text-xs transition-colors ${
                  idx === currentIndex && !isComplete
                    ? "bg-accent/40"
                    : "hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="size-7 rounded shrink-0 overflow-hidden border border-border/70 bg-muted flex items-center justify-center">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={shopifyThumbnailUrl(item.imageUrl, 56)}
                        alt={item.title}
                        className="size-full object-cover"
                      />
                    ) : (
                      <ImageOff className="size-3 text-muted-foreground" />
                    )}
                  </div>
                  <span className="truncate font-medium text-foreground">
                    {item.title}
                  </span>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {item.status === "completed" && (
                    <Badge
                      variant="outline"
                      className="border-transparent bg-success/10 text-success text-[11px] py-0 gap-1 font-normal"
                    >
                      <CheckCircle2 className="size-3" />
                      Analyzed
                    </Badge>
                  )}
                  {item.status === "processing" && (
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary text-[11px] py-0 gap-1 font-normal"
                    >
                      <Loader2 className="size-3 animate-spin" />
                      Processing
                    </Badge>
                  )}
                  {item.status === "failed" && (
                    <Badge
                      variant="outline"
                      className="border-destructive/30 bg-destructive/10 text-destructive text-[11px] py-0 gap-1 font-normal"
                      title={item.error}
                    >
                      <AlertCircle className="size-3" />
                      Failed
                    </Badge>
                  )}
                  {item.status === "pending" && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 px-1.5 py-0.5">
                      <Clock className="size-3" />
                      Queued
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="pt-2">
          {!isComplete ? (
            <p className="text-[11px] text-muted-foreground/80 w-full text-center sm:text-left">
              Please stay on this page while AI vision and studio generations complete.
            </p>
          ) : (
            <Button onClick={onClose} className="w-full sm:w-auto">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
