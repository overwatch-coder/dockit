"use client";

import { useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ProductPaginationNavProps {
  currentIndex: number;
  totalCount: number;
  prevProductId: string | null;
  nextProductId: string | null;
  className?: string;
  enableShortcuts?: boolean;
}

export function ProductPaginationNav({
  currentIndex,
  totalCount,
  prevProductId,
  nextProductId,
  className = "",
  enableShortcuts = true,
}: ProductPaginationNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryStr = searchParams?.toString() ? `?${searchParams.toString()}` : "";

  const prevHref = prevProductId ? `/products/${prevProductId}${queryStr}` : null;
  const nextHref = nextProductId ? `/products/${nextProductId}${queryStr}` : null;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enableShortcuts) return;

      // Ignore when typing in form controls or editable elements
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          target.getAttribute("role") === "textbox")
      ) {
        return;
      }

      // Ignore if modifier keys are pressed (Cmd, Ctrl, Alt)
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if ((event.key === "j" || event.key === "J") && nextHref) {
        event.preventDefault();
        router.push(nextHref);
      } else if ((event.key === "k" || event.key === "K") && prevHref) {
        event.preventDefault();
        router.push(prevHref);
      }
    },
    [enableShortcuts, nextHref, prevHref, router]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (totalCount <= 1) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 ${className}`}>
      <span className="text-xs font-mono text-muted-foreground select-none pr-1">
        {currentIndex} of {totalCount}
      </span>

      <div className="flex items-center gap-0.5 border border-border/80 rounded-md p-0.5 bg-background">
        {prevHref ? (
          <Link
            href={prevHref}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-xs" }),
              "size-7 rounded text-muted-foreground hover:text-foreground relative group"
            )}
            aria-label="Previous product"
            title="Previous product (K)"
          >
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-xs" }),
              "size-7 rounded text-muted-foreground/30 cursor-not-allowed hover:bg-transparent"
            )}
            aria-label="Previous product"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}

        {nextHref ? (
          <Link
            href={nextHref}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-xs" }),
              "size-7 rounded text-muted-foreground hover:text-foreground relative group"
            )}
            aria-label="Next product"
            title="Next product (J)"
          >
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-xs" }),
              "size-7 rounded text-muted-foreground/30 cursor-not-allowed hover:bg-transparent"
            )}
            aria-label="Next product"
          >
            <ChevronRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
