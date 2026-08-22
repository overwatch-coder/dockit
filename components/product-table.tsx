"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  ImageOff,
  MoreHorizontal,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  applyBulkAiSuggestions,
  duplicateProduct,
  generateBulkProductSeoSuggestions,
  pushSelectedProducts,
} from "@/app/(dashboard)/products/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ActionConfirmationModal,
  type ActionConfirmationVariant,
} from "@/components/action-confirmation-modal";
import { ChangeStatusDialog } from "@/components/change-status-dialog";
import { ConflictResolutionDialog } from "@/components/conflict-resolution-dialog";
import { DeleteFromShopifyDialog } from "@/components/delete-from-shopify-dialog";
import { ExportCsvButton } from "@/components/export-csv-button";
import { DeleteProductDialog } from "@/components/delete-product-dialog";
import { ProductStatusBadge } from "@/components/product-status-badge";
import { ProductTableRow } from "@/components/product-table-row";
import { PushResultsDialog } from "@/components/push-results-dialog";
import { BulkAiReviewDialog } from "@/components/bulk-ai-review-dialog";
import { useJobPolling } from "@/lib/hooks/use-job-polling";
import type {
  PaginatedProductsResult,
  ProductSummary,
} from "@/lib/db/products";
import type { Product, ProductStatus } from "@/types/product";
import type { PushBatchResultItem, PushBatchResults } from "@/types/job";
import type { BulkAiGenerationResult, BulkAiReviewItem } from "@/types/bulk-ai";

type StatusFilter = "all" | "DRAFT" | "ACTIVE" | "CONFLICT";

function shopifyAdminProductUrl(
  shopDomain: string,
  shopifyProductId: string,
): string {
  return `https://${shopDomain}/admin/products/${shopifyProductId}`;
}

interface ProductTableProps {
  paginatedResult: PaginatedProductsResult;
  categories: string[];
  shopDomain: string;
  initialSearch?: string;
  initialStatusFilter?: StatusFilter;
  initialCategoryFilter?: string;
  // Lightweight per-product summary across the whole catalog (not just the
  // current page) — only ever used for eligibility checks (shopifyProductId/
  // isConflicted) and title lookups, both of which fit in the lean
  // ProductSummary shape (lib/db/products.ts) instead of the full Product.
  allProducts: ProductSummary[];
}

export function ProductTable({
  paginatedResult,
  categories,
  shopDomain,
  initialSearch = "",
  initialStatusFilter = "all",
  initialCategoryFilter = "all",
  allProducts,
}: ProductTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startNavigation] = useTransition();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{
    ids: string[];
    label: string;
  } | null>(null);
  const [shopifyDeleteTarget, setShopifyDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [conflictTarget, setConflictTarget] = useState<Product | null>(null);

  const [searchText, setSearchText] = useState(initialSearch);

  useEffect(() => {
    setSearchText(initialSearch);
  }, [initialSearch]);

  const updateParams = useCallback(
    (newParams: Record<string, string | number | undefined>) => {
      const current = new URLSearchParams(searchParams.toString());
      Object.entries(newParams).forEach(([key, value]) => {
        if (
          value === undefined ||
          value === "" ||
          value === "all" ||
          (key === "page" && value === 1)
        ) {
          current.delete(key);
        } else {
          current.set(key, String(value));
        }
      });
      const searchString = current.toString();
      const query = searchString ? `?${searchString}` : "";
      startNavigation(() => {
        router.push(`${pathname}${query}`);
      });
    },
    [searchParams, pathname, router],
  );

  // Debounced search input syncing to URL
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchText !== initialSearch) {
        updateParams({ search: searchText, page: 1 });
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchText, initialSearch, updateParams]);

  const {
    products: paginatedProducts,
    totalCount,
    totalPages,
    page: currentPage,
    pageSize,
  } = paginatedResult;

  const allSelected =
    paginatedProducts.length > 0 &&
    paginatedProducts.every((product) => selectedIds.has(product.id));

  function toggleAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) {
        for (const product of paginatedProducts) next.delete(product.id);
      } else {
        for (const product of paginatedProducts) next.add(product.id);
      }
      return next;
    });
  }

  function toggleOne(productId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  const pushableSelectedIds = useMemo(
    () =>
      allProducts
        .filter(
          (product) =>
            selectedIds.has(product.id) &&
            product.shopifyProductId === null &&
            !product.isConflicted,
        )
        .map((product) => product.id),
    [allProducts, selectedIds],
  );

  const productTitles = useMemo(
    () =>
      Object.fromEntries(
        allProducts.map((product) => [product.id, product.title]),
      ),
    [allProducts],
  );

  // Per explicit user request: a small count on the Conflict tab itself, so
  // the owner can see at a glance how many products need resolving without
  // switching tabs first. Store-wide (allProducts, not the current page/
  // filter's records) since the point is visibility regardless of which tab
  // is currently active — same source dashboard-overview.tsx's own
  // "Conflicts" stat card already reads from.
  const conflictCount = useMemo(
    () => allProducts.filter((product) => product.isConflicted).length,
    [allProducts],
  );

  const [pushResultsItems, setPushResultsItems] = useState<
    PushBatchResultItem[] | null
  >(null);

  // Unit 16 follow-up, per explicit user request: a toast alone wasn't a
  // strong enough "did this actually work" signal for a Shopify push/sync —
  // a clean SUCCEEDED result now opens the shared animated-checkmark modal
  // (state declared below, near the other post-Unit-16 additions) instead
  // of a toast that could be missed. PARTIAL/FAILED keep their existing
  // toast + PushResultsDialog treatment unchanged — that's not what was
  // reported as hard to see.
  const [confirmation, setConfirmation] = useState<{
    variant: ActionConfirmationVariant;
    title: string;
    description?: string;
  } | null>(null);

  const [isPushPending, startPushTransition] = useTransition();
  const [isDuplicatePending, startDuplicateTransition] = useTransition();
  const [isBulkGenerating, startBulkGeneration] = useTransition();
  const [isBulkApplying, startBulkApply] = useTransition();
  const [bulkReview, setBulkReview] = useState<BulkAiGenerationResult | null>(
    null,
  );
  const { isPolling: isPushPolling, start: startPushPolling } = useJobPolling({
    onSettled: (status, results) => {
      const items = (results as PushBatchResults | undefined)?.items ?? [];
      const succeeded = items.filter((item) => item.success).length;
      const failed = items.length - succeeded;
      if (status === "SUCCEEDED") {
        setConfirmation({
          variant: "success",
          title: "Pushed to Shopify",
          description: `${succeeded} of ${items.length} product${items.length === 1 ? "" : "s"} synced successfully`,
        });
      } else {
        toast.error(
          `Pushed ${succeeded} of ${items.length} products — ${failed} failed`,
        );
        setPushResultsItems(items);
      }
      router.refresh();
    },
    onError: (message) => toast.error(message),
  });

  function handlePushSelected() {
    startPushTransition(async () => {
      const result = await pushSelectedProducts(pushableSelectedIds);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.message(
        `Pushing ${result.count} product${result.count === 1 ? "" : "s"}...`,
      );
      setSelectedIds(new Set());
      startPushPolling(result.jobId);
    });
  }

  function handleGenerateBulkSuggestions() {
    startBulkGeneration(async () => {
      const result = await generateBulkProductSeoSuggestions(
        Array.from(selectedIds),
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setBulkReview(result.data);
      if (result.data.failures.length > 0) {
        toast.warning(
          `${result.data.failures.length} product suggestion${result.data.failures.length === 1 ? "" : "s"} could not be generated.`,
        );
      }
    });
  }

  function handleApplyBulkSuggestions(suggestions: BulkAiReviewItem[]) {
    startBulkApply(async () => {
      const result = await applyBulkAiSuggestions(suggestions);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setBulkReview(null);
      setSelectedIds(new Set());
      setConfirmation({
        variant: "success",
        title: "AI suggestions saved",
        description: `${result.updatedCount} product${result.updatedCount === 1 ? "" : "s"} updated`,
      });
      router.refresh();
    });
  }

  // Unit 16 follow-up, per explicit user request: change a product's status
  // (single row, via the row dropdown, or a bulk selection, via the
  // toolbar) with an explicit choice of whether to sync it to Shopify —
  // shared by both call sites, same pattern as deleteTarget/DeleteProductDialog
  // above. A second, independent useJobPolling/results-dialog pair rather
  // than reusing the push-selected one above: the two flows have different
  // toast copy ("synced" vs "pushed") and shouldn't step on each other if
  // both happen to be in flight.
  const [statusChangeTarget, setStatusChangeTarget] = useState<{
    ids: string[];
    label: string;
    targetStatus: ProductStatus;
  } | null>(null);
  const [statusResultsItems, setStatusResultsItems] = useState<
    PushBatchResultItem[] | null
  >(null);
  const { start: startStatusSyncPolling } = useJobPolling({
    onSettled: (status, results) => {
      const items = (results as PushBatchResults | undefined)?.items ?? [];
      const succeeded = items.filter((item) => item.success).length;
      const failed = items.length - succeeded;
      if (status === "SUCCEEDED") {
        setConfirmation({
          variant: "success",
          title: "Synced to Shopify",
          description: `${succeeded} of ${items.length} product${items.length === 1 ? "" : "s"} updated successfully`,
        });
      } else {
        toast.error(
          `Synced ${succeeded} of ${items.length} products — ${failed} failed`,
        );
        setStatusResultsItems(items);
      }
      router.refresh();
    },
    onError: (message) => toast.error(message),
  });

  const handleToggleSelect = useCallback((productId: string) => {
    toggleOne(productId);
  }, []);

  const handleEdit = useCallback(
    (product: Product) => {
      router.push(`/products/${product.id}`);
    },
    [router],
  );

  const handleDuplicate = useCallback(
    (productId: string) => {
      if (isDuplicatePending) return;
      startDuplicateTransition(async () => {
        const result = await duplicateProduct(productId);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Product duplicated");
        router.push(`/products/${result.productId}`);
      });
    },
    [isDuplicatePending, router],
  );

  const handleChangeStatus = useCallback(
    (productId: string, title: string, currentStatus: ProductStatus) => {
      setStatusChangeTarget({
        ids: [productId],
        label: title,
        targetStatus: currentStatus === "DRAFT" ? "ACTIVE" : "DRAFT",
      });
    },
    [],
  );

  const handleDelete = useCallback((productId: string, title: string) => {
    setDeleteTarget({ ids: [productId], label: title });
  }, []);

  const handleDeleteShopify = useCallback(
    (productId: string, title: string) => {
      setShopifyDeleteTarget({ id: productId, title });
    },
    [],
  );

  const handleResolveConflict = useCallback((product: Product) => {
    setConflictTarget(product);
  }, []);

  function clearSelectionAndTarget() {
    setSelectedIds(new Set());
    setDeleteTarget(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Per explicit user request: conflicted products were easy to miss,
          buried in a "Status" dropdown alongside Draft/Active — a tab is a
          single click instead of open-dropdown-then-pick, and stays visible
          as a persistent option rather than a value the owner has to
          remember exists. Wired to the exact same updateParams call the old
          Select used, so getPaginatedProductsForStore's statusFilter
          handling (already supports "CONFLICT") needed no changes.
          Filtering stays exclusive — "All" keeps its normal newest-first
          order, no reordering surprises. */}
      <Tabs
        value={initialStatusFilter}
        onValueChange={(value) =>
          updateParams({ status: value ?? "all", page: 1 })
        }
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="DRAFT">Draft</TabsTrigger>
          <TabsTrigger value="ACTIVE">Active</TabsTrigger>
          <TabsTrigger value="CONFLICT">
            Conflict
            {conflictCount > 0 && (
              <span className="ml-1.5 rounded-full bg-conflict/15 px-1.5 py-0.5 text-label font-medium text-conflict">
                {conflictCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by title..."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          className="max-w-64"
        />
        <Select
          value={initialCategoryFilter}
          onValueChange={(value) =>
            updateParams({ category: value ?? "all", page: 1 })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Unit 26: reads the live (not yet URL-debounced) search text, so
            exporting right after typing doesn't lag one keystroke behind
            what's about to be searched. */}
        <ExportCsvButton
          search={searchText}
          statusFilter={initialStatusFilter}
          categoryFilter={initialCategoryFilter}
        />
      </div>
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-4 py-2">
          <p className="text-sm text-muted-foreground">
            {selectedIds.size} selected
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isBulkGenerating}
              onClick={handleGenerateBulkSuggestions}
            >
              <Sparkles className="size-4" />
              {isBulkGenerating ? "Generating..." : "Generate AI suggestions"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={
                pushableSelectedIds.length === 0 ||
                isPushPending ||
                isPushPolling
              }
              title={
                pushableSelectedIds.length === 0
                  ? "Select at least one product that hasn't been pushed to Shopify yet"
                  : undefined
              }
              onClick={handlePushSelected}
            >
              <Send className="size-4" />
              {isPushPending || isPushPolling
                ? "Pushing..."
                : `Push selected (${pushableSelectedIds.length})`}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" />}
              >
                Change status
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    setStatusChangeTarget({
                      ids: Array.from(selectedIds),
                      label: `${selectedIds.size} products`,
                      targetStatus: "ACTIVE",
                    })
                  }
                >
                  <Eye className="size-4" />
                  Set Active
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setStatusChangeTarget({
                      ids: Array.from(selectedIds),
                      label: `${selectedIds.size} products`,
                      targetStatus: "DRAFT",
                    })
                  }
                >
                  <EyeOff className="size-4" />
                  Set Draft
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                setDeleteTarget({
                  ids: Array.from(selectedIds),
                  label: `${selectedIds.size} products`,
                })
              }
            >
              Delete selected
            </Button>
          </div>
        </div>
      )}
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all products"
              />
            </TableHead>
            <TableHead className="w-14"></TableHead>
            <TableHead className="w-auto">Title</TableHead>
            <TableHead className="w-36 sm:w-40">Category</TableHead>
            <TableHead className="w-24 sm:w-28">Price</TableHead>
            <TableHead className="w-24 sm:w-28">Status</TableHead>
            <TableHead className="w-36 sm:w-44">Last synced</TableHead>
            <TableHead className="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedProducts.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-center text-sm text-muted-foreground py-8"
              >
                No products match your search or filters.
              </TableCell>
            </TableRow>
          )}
          {paginatedProducts.map((product) => (
            <ProductTableRow
              key={product.id}
              product={product}
              shopDomain={shopDomain}
              isSelected={selectedIds.has(product.id)}
              onToggleSelect={handleToggleSelect}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onChangeStatus={handleChangeStatus}
              onDelete={handleDelete}
              onDeleteShopify={handleDeleteShopify}
              onResolveConflict={handleResolveConflict}
            />
          ))}
        </TableBody>
      </Table>

      {/* Database Pagination Footer Controls */}
      {totalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 py-2 px-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                updateParams({ pageSize: val ?? "25", page: 1 });
              }}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue placeholder="25" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs sm:text-sm">
              {pageSize === "all"
                ? `Showing all ${totalCount} items`
                : `Showing ${Math.min((currentPage - 1) * (pageSize as number) + 1, totalCount)}–${Math.min(
                    currentPage * (pageSize as number),
                    totalCount,
                  )} of ${totalCount} items`}
            </span>
          </div>

          {pageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isNavigating}
                onClick={() =>
                  updateParams({ page: Math.max(1, currentPage - 1) })
                }
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <span className="font-medium text-foreground text-xs sm:text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isNavigating}
                onClick={() =>
                  updateParams({ page: Math.min(totalPages, currentPage + 1) })
                }
                aria-label="Next page"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      )}
      <DeleteProductDialog
        productIds={deleteTarget?.ids ?? null}
        label={deleteTarget?.label ?? ""}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={() => {
          const label = deleteTarget?.label ?? "Product";
          clearSelectionAndTarget();
          setConfirmation({
            variant: "delete",
            title: "Deleted",
            description: `${label} removed from Dockit`,
          });
        }}
      />
      <DeleteFromShopifyDialog
        product={shopifyDeleteTarget}
        onOpenChange={(open) => {
          if (!open) setShopifyDeleteTarget(null);
        }}
        onDeleted={() => {
          const title = shopifyDeleteTarget?.title ?? "Product";
          setShopifyDeleteTarget(null);
          setConfirmation({
            variant: "delete",
            title: "Deleted from Shopify",
            description: `${title} removed from Shopify and Dockit`,
          });
          router.refresh();
        }}
      />
      <ConflictResolutionDialog
        product={conflictTarget}
        onOpenChange={(open) => {
          if (!open) setConflictTarget(null);
        }}
        onResolved={(message) => {
          setConflictTarget(null);
          setConfirmation({
            variant: "success",
            title: "Conflict resolved",
            description: message,
          });
          router.refresh();
        }}
      />
      <PushResultsDialog
        open={pushResultsItems !== null}
        onOpenChange={(open) => {
          if (!open) setPushResultsItems(null);
        }}
        items={pushResultsItems ?? []}
        productTitles={productTitles}
      />
      <ChangeStatusDialog
        target={statusChangeTarget}
        onOpenChange={(open) => {
          if (!open) setStatusChangeTarget(null);
        }}
        onLocalUpdate={(count) => {
          setSelectedIds(new Set());
          setConfirmation({
            variant: "success",
            title: "Status updated",
            description: `${count} product${count === 1 ? "" : "s"} updated locally`,
          });
          router.refresh();
        }}
        onSyncStarted={(jobId, count) => {
          setSelectedIds(new Set());
          toast.message(
            `Syncing ${count} product${count === 1 ? "" : "s"} to Shopify...`,
          );
          startStatusSyncPolling(jobId);
        }}
      />
      <PushResultsDialog
        open={statusResultsItems !== null}
        onOpenChange={(open) => {
          if (!open) setStatusResultsItems(null);
        }}
        items={statusResultsItems ?? []}
        productTitles={productTitles}
      />
      <ActionConfirmationModal
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        variant={confirmation?.variant ?? "success"}
        title={confirmation?.title ?? ""}
        description={confirmation?.description}
      />
      <BulkAiReviewDialog
        open={bulkReview !== null}
        onOpenChange={(open) => {
          if (!open && !isBulkApplying) setBulkReview(null);
        }}
        storeId={bulkReview?.storeId ?? ""}
        collections={bulkReview?.collections ?? []}
        suggestions={bulkReview?.suggestions ?? []}
        isApplying={isBulkApplying}
        onApply={handleApplyBulkSuggestions}
      />
    </div>
  );
}
