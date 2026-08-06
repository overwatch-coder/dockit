"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Eye,
  EyeOff,
  ImageOff,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { pushSelectedProducts } from "@/app/(dashboard)/products/actions";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionConfirmationModal, type ActionConfirmationVariant } from "@/components/action-confirmation-modal";
import { ChangeStatusDialog } from "@/components/change-status-dialog";
import { DeleteFromShopifyDialog } from "@/components/delete-from-shopify-dialog";
import { DeleteProductDialog } from "@/components/delete-product-dialog";
import { ProductStatusBadge } from "@/components/product-status-badge";
import { PushResultsDialog } from "@/components/push-results-dialog";
import { useJobPolling } from "@/lib/hooks/use-job-polling";
import type { Product, ProductStatus } from "@/types/product";
import type { PushBatchResultItem, PushBatchResults } from "@/types/job";

type StatusFilter = "all" | "DRAFT" | "ACTIVE" | "CONFLICT";

const lastSyncedFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

// Product.shopifyProductId is stored as the bare numeric id, never the full
// GID (lib/shopify/products.ts's toBareId strips it on import/push) — the
// classic /admin/products/<id> path resolves on any shopifyDomain and
// redirects into the merchant's real admin, no store handle lookup needed.
function shopifyAdminProductUrl(shopDomain: string, shopifyProductId: string): string {
  return `https://${shopDomain}/admin/products/${shopifyProductId}`;
}

// Small client wrapper for row-click navigation, selection, delete, a batch
// push, and (Unit 16 follow-up) an Active/Draft status change with an
// optional immediate Shopify sync — the rest of the product list page stays
// a server component (code-standards.md). Pulling in the *latest* state
// from Shopify (Sync Store) isn't real yet — that's Units 17-19.
export function ProductTable({ products, shopDomain }: { products: Product[]; shopDomain: string }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null);
  // Unit 16 follow-up, per explicit user request: a separate, single-product-only
  // target for the far more dangerous "delete from Shopify too" action —
  // deliberately not merged with deleteTarget above (which stays the fast,
  // reversible, Dockit-only delete).
  const [shopifyDeleteTarget, setShopifyDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((product) => product.collectionTitle).filter(Boolean))) as string[],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return products.filter((product) => {
      if (query && !product.title.toLowerCase().includes(query)) return false;
      if (statusFilter === "CONFLICT" && !product.isConflicted) return false;
      if (statusFilter === "DRAFT" && (product.status !== "DRAFT" || product.isConflicted)) return false;
      if (statusFilter === "ACTIVE" && (product.status !== "ACTIVE" || product.isConflicted)) return false;
      if (categoryFilter !== "all" && product.collectionTitle !== categoryFilter) return false;
      return true;
    });
  }, [products, searchText, statusFilter, categoryFilter]);

  const allSelected =
    filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.has(product.id));

  function toggleAll() {
    setSelectedIds((current) => {
      if (allSelected) {
        const next = new Set(current);
        for (const product of filteredProducts) next.delete(product.id);
        return next;
      }
      const next = new Set(current);
      for (const product of filteredProducts) next.add(product.id);
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

  // Unit 16, corrected per explicit user feedback: eligible for a push
  // means never synced to Shopify (shopifyProductId === null) — a product's
  // local DRAFT/ACTIVE status is independent of that, and a locally-DRAFT
  // product that's already been pushed once should NOT be silently
  // re-pushed by this bulk action (that stays the editor's explicit
  // Republish button). Computed from the full `products` prop, not
  // `filteredProducts`, so a selection made before a filter change stays
  // correct. The server action re-validates this same eligibility (defense
  // in depth), so this is purely what the button shows/enables, not the
  // only guard.
  const pushableSelectedIds = useMemo(
    () =>
      products
        .filter(
          (product) => selectedIds.has(product.id) && product.shopifyProductId === null && !product.isConflicted
        )
        .map((product) => product.id),
    [products, selectedIds]
  );

  // Unit 16 follow-up: per-product results (already saved to Job.results)
  // had no UI beyond a summary toast that disappears — auto-open a dialog
  // listing each product's outcome whenever a batch settles with at least
  // one failure, so "something failed" doesn't leave the owner with nothing
  // to act on. A clean SUCCEEDED result stays toast-only; there's nothing to
  // review.
  const [pushResultsItems, setPushResultsItems] = useState<PushBatchResultItem[] | null>(null);
  const productTitles = useMemo(
    () => Object.fromEntries(products.map((product) => [product.id, product.title])),
    [products]
  );

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
        toast.error(`Pushed ${succeeded} of ${items.length} products — ${failed} failed`);
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
      toast.message(`Pushing ${result.count} product${result.count === 1 ? "" : "s"}...`);
      setSelectedIds(new Set());
      startPushPolling(result.jobId);
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
  const [statusResultsItems, setStatusResultsItems] = useState<PushBatchResultItem[] | null>(null);
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
        toast.error(`Synced ${succeeded} of ${items.length} products — ${failed} failed`);
        setStatusResultsItems(items);
      }
      router.refresh();
    },
    onError: (message) => toast.error(message),
  });

  function clearSelectionAndTarget() {
    setSelectedIds(new Set());
    setDeleteTarget(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by title..."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          className="max-w-64"
        />
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter((value ?? "all") as StatusFilter)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="CONFLICT">Conflict</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value ?? "all")}>
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
      </div>
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-4 py-2">
          <p className="text-sm text-muted-foreground">{selectedIds.size} selected</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pushableSelectedIds.length === 0 || isPushPending || isPushPolling}
              title={
                pushableSelectedIds.length === 0
                  ? "Select at least one product that hasn't been pushed to Shopify yet"
                  : undefined
              }
              onClick={handlePushSelected}
            >
              <Send className="size-4" />
              {isPushPending || isPushPolling ? "Pushing..." : `Push selected (${pushableSelectedIds.length})`}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
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
                setDeleteTarget({ ids: Array.from(selectedIds), label: `${selectedIds.size} products` })
              }
            >
              Delete selected
            </Button>
          </div>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all products" />
            </TableHead>
            <TableHead className="w-14"></TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last synced</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProducts.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                No products match your search or filters.
              </TableCell>
            </TableRow>
          )}
          {filteredProducts.map((product) => (
            <TableRow
              key={product.id}
              className="cursor-pointer"
              onClick={() => router.push(`/products/${product.id}`)}
            >
              <TableCell onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(product.id)}
                  onCheckedChange={() => toggleOne(product.id)}
                  aria-label={`Select ${product.title}`}
                />
              </TableCell>
              <TableCell>
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Shopify CDN host isn't guaranteed constant across every store, so this isn't allowlisted through next/image.
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="size-10 rounded-sm border border-border object-cover"
                  />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-sm border border-border bg-muted">
                    <ImageOff className="size-4 text-muted-foreground" />
                  </div>
                )}
              </TableCell>
              <TableCell className="max-w-64 truncate font-medium text-foreground">
                {product.title}
              </TableCell>
              <TableCell className="text-muted-foreground">{product.collectionTitle ?? "—"}</TableCell>
              <TableCell className="font-mono text-table-data">{product.price}</TableCell>
              <TableCell>
                <ProductStatusBadge product={product} />
              </TableCell>
              <TableCell className="font-mono text-table-data text-muted-foreground">
                {product.lastSyncedAt ? lastSyncedFormatter.format(product.lastSyncedAt) : "—"}
              </TableCell>
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${product.title}`} />
                    }
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-44">
                    <DropdownMenuItem onClick={() => router.push(`/products/${product.id}`)}>
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    {product.shopifyProductId && (
                      <DropdownMenuItem
                        render={
                          <a
                            href={shopifyAdminProductUrl(shopDomain, product.shopifyProductId)}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        <ExternalLink className="size-4" />
                        {/* Shorter than "View on Shopify" — that wrapped onto
                            two lines inside this menu's width, unlike every
                            other (single-word) item here. The icon already
                            signals "opens externally"; the menu's own
                            width (min-w-44 above, widened again for "Delete
                            from Shopify" below) also has more room now,
                            matching this label on the product detail page's
                            header button. */}
                        Shopify
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() =>
                        setStatusChangeTarget({
                          ids: [product.id],
                          label: product.title,
                          targetStatus: product.status === "DRAFT" ? "ACTIVE" : "DRAFT",
                        })
                      }
                    >
                      {product.status === "DRAFT" ? (
                        <>
                          <Eye className="size-4" />
                          Set Active
                        </>
                      ) : (
                        <>
                          <EyeOff className="size-4" />
                          Set Draft
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteTarget({ ids: [product.id], label: product.title })}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                    {product.shopifyProductId && (
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() =>
                          setShopifyDeleteTarget({ id: product.id, title: product.title })
                        }
                      >
                        <TriangleAlert className="size-4" />
                        Delete from Shopify
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <DeleteProductDialog
        productIds={deleteTarget?.ids ?? null}
        label={deleteTarget?.label ?? ""}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={() => {
          const label = deleteTarget?.label ?? "Product";
          clearSelectionAndTarget();
          setConfirmation({ variant: "delete", title: "Deleted", description: `${label} removed from Dockit` });
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
          toast.message(`Syncing ${count} product${count === 1 ? "" : "s"} to Shopify...`);
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
    </div>
  );
}
