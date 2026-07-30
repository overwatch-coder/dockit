"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteProductDialog } from "@/components/delete-product-dialog";
import { ProductStatusBadge } from "@/components/product-status-badge";
import type { Product } from "@/types/product";

const lastSyncedFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

// Small client wrapper just for row-click navigation, selection, and delete
// — the rest of the product list page stays a server component
// (code-standards.md). Edit/Sync/Publish/Draft-toggle beyond navigation
// aren't real yet (no Shopify write mutations or jobs exist — Units 15-17),
// so only Edit (navigation) and Delete (app-database-only) are wired here.
export function ProductTable({ products }: { products: Product[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null);

  const allSelected = products.length > 0 && selectedIds.size === products.length;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(products.map((product) => product.id)));
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

  function clearSelectionAndTarget() {
    setSelectedIds(new Set());
    setDeleteTarget(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-4 py-2">
          <p className="text-sm text-muted-foreground">{selectedIds.size} selected</p>
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
          {products.map((product) => (
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
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${product.title}`}
                    onClick={() => router.push(`/products/${product.id}`)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${product.title}`}
                    onClick={() => setDeleteTarget({ ids: [product.id], label: product.title })}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
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
        onDeleted={clearSelectionAndTarget}
      />
    </div>
  );
}
