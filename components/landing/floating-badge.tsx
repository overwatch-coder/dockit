import React from "react";
import { Sparkles, RefreshCw, CheckCircle2 } from "lucide-react";

interface FloatingBadgeProps {
  variant: "left-foreground" | "right-background";
}

export function FloatingBadge({ variant }: FloatingBadgeProps) {
  if (variant === "left-foreground") {
    return (
      <div className="absolute -left-4 top-1/2 z-20 hidden -translate-y-1/2 items-center gap-3 rounded-2xl border border-primary/30 bg-surface/90 p-3.5 shadow-[0_20px_50px_rgba(91,95,239,0.25)] backdrop-blur-xl transition-transform duration-500 hover:scale-105 animate-in fade-in slide-in-from-bottom-4 md:flex">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/20 text-primary ring-1 ring-primary/40 shadow-inner">
          <Sparkles className="size-5 text-primary animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span>AI SEO & Tags</span>
            <span className="inline-flex items-center rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
              Ready
            </span>
          </div>
          <p className="text-[11px] text-foreground-muted">Generated in 1 click</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 items-center gap-3 rounded-2xl border border-primary/20 bg-surface/80 p-3 shadow-[0_15px_40px_rgba(124,58,237,0.15)] backdrop-blur-md opacity-90 transition-transform duration-500 hover:scale-105 animate-in fade-in slide-in-from-bottom-6 md:flex">
      <div className="flex size-9 items-center justify-center rounded-xl bg-conflict/20 text-conflict ring-1 ring-conflict/30">
        <RefreshCw className="size-4.5 text-conflict" />
      </div>
      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span>Shopify Sync</span>
          <CheckCircle2 className="size-3.5 text-success" />
        </div>
        <p className="text-[11px] text-foreground-muted">Zero conflicts detected</p>
      </div>
    </div>
  );
}
