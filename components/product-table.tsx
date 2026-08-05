"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ImageOff, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { DeleteProductDialog } from "@/components/delete-product-dialog";
import { ProductStatusBadge } from "@/components/product-status-badge";
import type { Product } from "@/types/product";

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

// Small client wrapper just for row-click navigation, selection, and delete
// — the rest of the product list page stays a server component
// (code-standards.md). Edit/Sync/Publish/Draft-toggle beyond navigation
// aren't real yet (no Shopify write mutations or jobs exist — Units 15-17),
// so only Edit (navigation) and Delete (app-database-only) are wired here.
export function ProductTable({ products, shopDomain }: { products: Product[]; shopDomain: string }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null);
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
                  <DropdownMenuContent align="end">
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
                        View on Shopify
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteTarget({ ids: [product.id], label: product.title })}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
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
        onDeleted={clearSelectionAndTarget}
      />
    </div>
  );
}
