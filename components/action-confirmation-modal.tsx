"use client";

import { useEffect, type CSSProperties } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ActionConfirmationVariant = "success" | "delete";

const CHECK_CIRCLE_RADIUS = 22;
const CHECK_CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CHECK_CIRCLE_RADIUS;

// Shared "this actually finished" confirmation, per explicit user request:
// a toast alone wasn't a strong enough signal for "did my Shopify push/sync
// really work" — this is a brief, centered modal with an animated checkmark
// (or a trash icon for delete), reused everywhere something completes
// (push/sync, save, delete) with only the icon/copy swapped per caller, not
// a new one-off component per flow. Auto-closes on its own after
// `autoCloseMs` (still dismissible earlier via backdrop/Escape, same as any
// other Dialog), so it doesn't require an extra click for something that
// already succeeded.
export function ActionConfirmationModal({
  open,
  onOpenChange,
  variant = "success",
  title,
  description,
  autoCloseMs = 2000,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: ActionConfirmationVariant;
  title: string;
  description?: string;
  // Pass null to require a manual/backdrop close instead of auto-dismissing.
  autoCloseMs?: number | null;
}) {
  // Timer-driven self-dismiss, same pattern as components/connect-store-dialog.tsx's
  // DialogError auto-hide — setState happens inside the timer callback, not
  // synchronously in the effect body.
  useEffect(() => {
    if (!open || autoCloseMs === null) return;
    const timer = setTimeout(() => onOpenChange(false), autoCloseMs);
    return () => clearTimeout(timer);
  }, [open, autoCloseMs, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-w-[19rem] flex-col items-center gap-3 py-8 text-center"
      >
        <div
          className={cn(
            "flex size-16 items-center justify-center rounded-full animate-confirmation-circle",
            variant === "delete" ? "bg-destructive/10" : "bg-success/10"
          )}
        >
          {variant === "delete" ? (
            <Trash2 className="size-7 text-destructive" />
          ) : (
            <svg viewBox="0 0 48 48" className="size-9" fill="none" aria-hidden="true">
              <circle
                cx="24"
                cy="24"
                r={CHECK_CIRCLE_RADIUS}
                className="stroke-success"
                strokeWidth="3"
                strokeDasharray={CHECK_CIRCLE_CIRCUMFERENCE}
                strokeDashoffset={CHECK_CIRCLE_CIRCUMFERENCE}
                style={
                  {
                    "--confirmation-stroke-length": CHECK_CIRCLE_CIRCUMFERENCE,
                    animation: "confirmation-stroke-draw 0.5s ease-out forwards",
                  } as CSSProperties
                }
              />
              <path
                d="M14 25l6.5 6.5L34 18"
                className="stroke-success animate-confirmation-check"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="40"
                strokeDashoffset="40"
              />
            </svg>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
