"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ProductPaginationNavProps {
  currentIndex: number;
  totalCount: number;
  prevProductId: string | null;
  nextProductId: string | null;
  className?: string;
}

export function ProductPaginationNav({
  currentIndex,
  totalCount,
  prevProductId,
  nextProductId,
  className = "",
}: ProductPaginationNavProps) {
  if (totalCount <= 1) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 ${className}`}>
      <span className="text-xs font-mono text-muted-foreground select-none pr-1">
        {currentIndex} of {totalCount}
      </span>

      <div className="flex items-center gap-0.5 border border-border/80 rounded-md p-0.5 bg-background">
        {prevProductId ? (
          <Link
            href={`/products/${prevProductId}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-xs" }),
              "size-7 rounded text-muted-foreground hover:text-foreground"
            )}
            aria-label="Previous product"
            title="Previous product"
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

        {nextProductId ? (
          <Link
            href={`/products/${nextProductId}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-xs" }),
              "size-7 rounded text-muted-foreground hover:text-foreground"
            )}
            aria-label="Next product"
            title="Next product"
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
