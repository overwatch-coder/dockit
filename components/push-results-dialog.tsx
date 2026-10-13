"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PushBatchResultItem } from "@/types/job";

// Displays detailed per-product batch push results and error messages inline
// when a batch finishes with failures.
export function PushResultsDialog({
  open,
  onOpenChange,
  items,
  productTitles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PushBatchResultItem[];
  productTitles: Record<string, string>;
}) {
  const succeeded = items.filter((item) => item.success).length;
  const failed = items.length - succeeded;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Push results</DialogTitle>
          <DialogDescription>
            {succeeded} of {items.length} product{items.length === 1 ? "" : "s"} pushed to Shopify
            {failed > 0 ? ` — ${failed} failed` : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              {item.success ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className="truncate font-medium text-foreground">
                  {productTitles[item.productId] ?? item.productId}
                </span>
                {!item.success && <span className="text-destructive">{item.error}</span>}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
