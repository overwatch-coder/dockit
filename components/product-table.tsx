"use client";

import { useRouter } from "next/navigation";
import { ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Product } from "@/types/product";

const lastSyncedFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function StatusBadge({ product }: { product: Product }) {
  if (product.isConflicted) {
    return (
      <Badge className="border-transparent bg-conflict/10 text-conflict">Conflict</Badge>
    );
  }
  if (product.status === "ACTIVE") {
    return <Badge className="border-transparent bg-success/10 text-success">Active</Badge>;
  }
  return <Badge className="border-transparent bg-warning/10 text-warning">Draft</Badge>;
}

// Small client wrapper just for row-click navigation — the rest of the
// product list page stays a server component (code-standards.md).
export function ProductTable({ products }: { products: Product[] }) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14"></TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last synced</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow
            key={product.id}
            className="cursor-pointer"
            onClick={() => router.push(`/products/${product.id}`)}
          >
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
            <TableCell className="font-mono text-table-data">{product.price}</TableCell>
            <TableCell>
              <StatusBadge product={product} />
            </TableCell>
            <TableCell className="font-mono text-table-data text-muted-foreground">
              {product.lastSyncedAt ? lastSyncedFormatter.format(product.lastSyncedAt) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
