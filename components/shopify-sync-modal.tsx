"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ImageOff, Loader2, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  previewShopifyProductsAction,
  syncSelectedShopifyProductsAction,
  type ProductPreviewItem,
} from "@/app/(dashboard)/products/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { productThumbnailUrl } from "@/lib/shopify/image-url";
import { cn } from "@/lib/utils";

export const MAX_SELECTION = 100;

export function formatSyncCategoryDisplay(
  categoryFullName?: string | null,
  collectionTitle?: string | null
): string | null {
  if (categoryFullName && categoryFullName.trim()) {
    const parts = categoryFullName.split(" > ");
    return parts[parts.length - 1]?.trim() || categoryFullName.trim();
  }
  if (collectionTitle && collectionTitle.trim()) {
    return collectionTitle.trim();
  }
  return null;
}

export function formatSyncSelectionCount(
  selectedCount: number,
  totalCount?: number
): string {
  const noun = selectedCount === 1 ? "product" : "products";
  if (totalCount !== undefined && totalCount > 0) {
    return `${selectedCount} ${noun} selected of ${totalCount}`;
  }
  return `${selectedCount} ${noun} selected`;
}

export function formatSyncImportButtonText(
  selectedCount: number,
  isMobile = false
): string {
  if (isMobile) {
    return selectedCount > 0 ? `Import (${selectedCount})` : "Import";
  }
  return selectedCount > 0 ? `Import Selected (${selectedCount})` : "Import Selected";
}

interface ShopifySyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncStarted: (jobId: string) => void;
}

export function ShopifySyncModal({
  open,
  onOpenChange,
  onSyncStarted,
}: ShopifySyncModalProps) {
  const [items, setItems] = useState<ProductPreviewItem[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isStarting, startTransition] = useTransition();
  const requestVersion = useRef(0);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setSearchInput("");
      setQuery("");
      setItems([]);
      setCursor(null);
      setHasMore(false);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  // Debounced search query
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [open, searchInput]);

  // Fetch products on open or whenever query changes (including clearing search)
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    const version = ++requestVersion.current;

    previewShopifyProductsAction(query ? { query } : undefined)
      .then((res) => {
        if (requestVersion.current !== version) return;
        if ("error" in res) {
          setError(res.error);
        } else {
          setItems(res.data.items);
          setCursor(res.data.pageInfo.endCursor);
          setHasMore(res.data.pageInfo.hasNextPage);
        }
      })
      .catch((err) => {
        if (requestVersion.current !== version) return;
        setError(err instanceof Error ? err.message : "Failed to load products");
      })
      .finally(() => {
        if (requestVersion.current === version) setLoading(false);
      });
  }, [open, query]);

  function handleClearSearch() {
    setSearchInput("");
    setQuery("");
  }

  async function handleLoadMore() {
    if (!cursor || !hasMore || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    const version = requestVersion.current;

    try {
      const res = await previewShopifyProductsAction({
        query: query || undefined,
        after: cursor,
      });
      if (requestVersion.current !== version) return;
      if ("error" in res) {
        setError(res.error);
      } else {
        setItems((current) => {
          const seen = new Set(current.map((item) => item.shopifyProductId));
          const newItems = res.data.items.filter(
            (item) => !seen.has(item.shopifyProductId)
          );
          return [...current, ...newItems];
        });
        setCursor(res.data.pageInfo.endCursor);
        setHasMore(res.data.pageInfo.hasNextPage);
      }
    } catch (err) {
      if (requestVersion.current === version) {
        setError(err instanceof Error ? err.message : "Failed to load more products");
      }
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleProduct(shopifyProductId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(shopifyProductId)) {
        next.delete(shopifyProductId);
      } else {
        if (next.size >= MAX_SELECTION) {
          toast.error(`You can select at most ${MAX_SELECTION} products at once.`);
          return current;
        }
        next.add(shopifyProductId);
      }
      return next;
    });
  }

  const allCurrentSelected =
    items.length > 0 && items.every((i) => selectedIds.has(i.shopifyProductId));

  function handleSelectAll() {
    if (allCurrentSelected) {
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const item of items) {
          next.delete(item.shopifyProductId);
        }
        return next;
      });
    } else {
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const item of items) {
          if (next.size >= MAX_SELECTION) {
            toast.error(`You can select at most ${MAX_SELECTION} products at once.`);
            break;
          }
          next.add(item.shopifyProductId);
        }
        return next;
      });
    }
  }

  function handleConfirmSync() {
    if (selectedIds.size === 0) return;
    setError(null);

    startTransition(async () => {
      const result = await syncSelectedShopifyProductsAction(Array.from(selectedIds));
      if ("error" in result) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
      onSyncStarted(result.jobId);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex w-[calc(100vw-1.5rem)] sm:w-[min(94vw,46rem)] max-w-2xl max-h-[92dvh] sm:max-h-[85vh] flex-col gap-0 p-0 overflow-hidden rounded-xl sm:rounded-2xl"
      >
        <DialogHeader className="shrink-0 border-b border-border bg-card px-4 py-3.5 sm:px-6 sm:py-4">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold pr-8 sm:pr-0">
            <RefreshCw className="size-4.5 sm:size-5 text-primary shrink-0" />
            <span>Sync products from Shopify</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1">
            Select which products you want to import or update in Dockit. Their categories and
            collections will be imported and mapped automatically.
          </DialogDescription>

          <div className="mt-3 flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs sm:text-sm"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-sm"
                  aria-label="Clear search"
                >
                  <X className="size-3.5 sm:size-4" />
                </button>
              )}
            </div>
            {items.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs h-9 px-2.5 sm:px-3 shrink-0 font-medium whitespace-nowrap"
              >
                {allCurrentSelected ? "Deselect all" : "Select all"}
              </Button>
            )}
          </div>
        </DialogHeader>

        {error && (
          <div className="border-b bg-destructive/10 px-4 py-2.5 sm:px-6 text-xs font-medium text-destructive">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4 space-y-2 sm:space-y-2.5 min-h-48 max-h-[50dvh] sm:max-h-[55vh] overscroll-contain">
          {loading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-xs sm:text-sm">Fetching catalog from Shopify...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-1.5 text-muted-foreground px-4">
              <p className="text-sm font-medium text-foreground">No products found</p>
              <p className="text-xs text-center max-w-xs text-muted-foreground">
                {query ? `No products matching "${query}".` : "No products available in this Shopify store."}
              </p>
              {query && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearSearch}
                  className="mt-2 text-xs h-8"
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            items.map((item) => {
              const isSelected = selectedIds.has(item.shopifyProductId);
              const categoryDisplay = formatSyncCategoryDisplay(
                item.categoryFullName,
                item.collectionTitle
              );

              return (
                <label
                  key={item.shopifyProductId}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 sm:gap-3.5 rounded-lg border p-2.5 sm:p-3 transition-colors",
                    isSelected
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleProduct(item.shopifyProductId)}
                    className="shrink-0"
                  />

                  {item.imageUrl ? (
                    <img
                      src={productThumbnailUrl(item.imageUrl, 96)}
                      alt={item.title}
                      className="size-11 sm:size-12 rounded-md border border-border object-cover shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-11 sm:size-12 items-center justify-center rounded-md border border-border bg-muted shrink-0">
                      <ImageOff className="size-4 sm:size-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs sm:text-sm font-medium text-foreground">
                      {item.title}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-1.5 py-0 text-[10px] font-normal shrink-0",
                          item.status === "ACTIVE"
                            ? "border-success/30 text-success"
                            : "border-warning/30 text-warning"
                        )}
                      >
                        {item.status === "ACTIVE" ? "Active" : "Draft"}
                      </Badge>

                      <Badge
                        variant="secondary"
                        className="px-1.5 py-0 text-[10px] font-normal shrink-0"
                      >
                        {item.existing ? "Existing in Dockit" : "New product"}
                      </Badge>

                      {categoryDisplay && (
                        <>
                          <span className="text-muted-foreground/60">·</span>
                          <span
                            className="max-w-32 sm:max-w-44 truncate text-[11px] sm:text-xs"
                            title={item.categoryFullName ?? item.collectionTitle ?? undefined}
                          >
                            {categoryDisplay}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </label>
              );
            })
          )}

          {hasMore && !loading && (
            <div className="pt-2 text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={handleLoadMore}
                className="w-full text-xs h-8 sm:h-9"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading more products...
                  </>
                ) : (
                  "Load more products"
                )}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="m-0 sm:m-0 mx-0 mb-0 sm:mx-0 sm:mb-0 shrink-0 border-t border-border bg-muted/40 px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto text-xs sm:text-sm text-muted-foreground">
            <div>
              <span className="font-semibold text-foreground">{selectedIds.size}</span>{" "}
              <span>{selectedIds.size === 1 ? "product" : "products"} selected</span>
              {items.length > 0 && (
                <span className="text-muted-foreground/80"> of {items.length}</span>
              )}
              {selectedIds.size >= MAX_SELECTION && (
                <span className="ml-1.5 font-medium text-warning">(max {MAX_SELECTION})</span>
              )}
            </div>

            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 sm:hidden transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isStarting}
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto h-9 text-xs sm:text-sm font-medium"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selectedIds.size === 0 || isStarting}
              onClick={handleConfirmSync}
              className="w-full sm:w-auto h-9 text-xs sm:text-sm font-medium"
            >
              {isStarting ? (
                <>
                  <Loader2 className="size-3.5 sm:size-4 animate-spin shrink-0" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">
                    {formatSyncImportButtonText(selectedIds.size, true)}
                  </span>
                  <span className="hidden sm:inline">
                    {formatSyncImportButtonText(selectedIds.size, false)}
                  </span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
