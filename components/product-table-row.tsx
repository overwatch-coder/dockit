"use client";

import { memo } from "react";
import { Copy, ExternalLink, Eye, EyeOff, ImageOff, MoreHorizontal, Pencil, Sparkles, Trash2, TriangleAlert, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { ProductStatusBadge } from "@/components/product-status-badge";
import { shopifyThumbnailUrl } from "@/lib/shopify/image-url";
import type { Product, ProductStatus } from "@/types/product";

// 2x the 40px (size-10) display box, for retina — see lib/shopify/image-url.ts
// for why this exists at all (was the actual cause of the reported scroll
// lag: the <img> below used to request product.imageUrl's full original
// resolution, CSS-downscaled, so every row's decode work landed right as it
// scrolled into view).
const THUMBNAIL_SIZE = 80;

const lastSyncedFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function shopifyAdminProductUrl(shopDomain: string | null, shopifyProductId: string): string {
  return shopDomain ? `https://${shopDomain}/admin/products/${shopifyProductId}` : "#";
}

interface ProductTableRowProps {
  product: Product;
  shopDomain: string | null;
  isSelected: boolean;
  onToggleSelect: (productId: string) => void;
  onEdit: (product: Product) => void;
  onDuplicate: (productId: string) => void;
  onEnrichWithAi?: (product: Product) => void;
  onGenerateImages?: (product: Product) => void;
  onChangeStatus: (productId: string, title: string, currentStatus: ProductStatus) => void;
  onDelete: (productId: string, title: string) => void;
  onDeleteShopify: (productId: string, title: string) => void;
  onResolveConflict: (product: Product) => void;
}

export const ProductTableRow = memo(function ProductTableRow({
  product,
  shopDomain,
  isSelected,
  onToggleSelect,
  onEdit,
  onDuplicate,
  onEnrichWithAi,
  onGenerateImages,
  onChangeStatus,
  onDelete,
  onDeleteShopify,
  onResolveConflict,
}: ProductTableRowProps) {
  const handleRowClick = () => {
    if (product.isConflicted) {
      onResolveConflict(product);
    } else {
      onEdit(product);
    }
  };

  return (
    <TableRow className="cursor-pointer" onClick={handleRowClick}>
      <TableCell onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(product.id)}
          aria-label={`Select ${product.title}`}
        />
      </TableCell>
      <TableCell>
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Shopify CDN host isn't guaranteed constant across every store
          <img
            src={shopifyThumbnailUrl(product.imageUrl, THUMBNAIL_SIZE)}
            alt={product.title}
            className="size-10 rounded-sm border border-border object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-sm border border-border bg-muted">
            <ImageOff className="size-4 text-muted-foreground" />
          </div>
        )}
      </TableCell>
      <TableCell className="min-w-[180px] max-w-64 truncate font-medium text-foreground">
        {product.title}
      </TableCell>
      <TableCell className="w-36 sm:w-40 max-w-48 truncate text-muted-foreground" title={product.categoryFullName ?? product.collectionTitle ?? undefined}>
        {product.categoryFullName
          ? (product.categoryFullName.split(" > ").pop() ?? product.categoryFullName)
          : (product.collectionTitle ?? "—")}
      </TableCell>
      <TableCell className="w-20 sm:w-24 font-mono text-table-data">{product.price}</TableCell>

      <TableCell className="w-24 sm:w-28">
        <ProductStatusBadge product={product} />
      </TableCell>
      <TableCell className="w-32 sm:w-44 font-mono text-table-data text-muted-foreground whitespace-nowrap">
        {product.lastSyncedAt ? lastSyncedFormatter.format(product.lastSyncedAt) : "—"}
      </TableCell>
      <TableCell className="w-16 sm:w-20 text-right" onClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${product.title}`} />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={() => (product.isConflicted ? onResolveConflict(product) : onEdit(product))}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            {onEnrichWithAi && (
              <DropdownMenuItem onClick={() => onEnrichWithAi(product)}>
                <Sparkles className="size-4 text-primary" />
                Generate with AI Vision
              </DropdownMenuItem>
            )}
            {onGenerateImages && (
              <DropdownMenuItem onClick={() => onGenerateImages(product)}>
                <Wand2 className="size-4 text-primary" />
                Generate Images with AI
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDuplicate(product.id)}>
              <Copy className="size-4" />
              Duplicate
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
                Shopify
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => onChangeStatus(product.id, product.title, product.status)}
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
              onClick={() => onDelete(product.id, product.title)}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
            {product.shopifyProductId && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDeleteShopify(product.id, product.title)}
              >
                <TriangleAlert className="size-4" />
                Delete from Shopify
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});
