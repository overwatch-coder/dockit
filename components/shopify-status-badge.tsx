import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/types/product";

function shopifyAdminProductUrl(
  shopDomain: string | null,
  shopifyProductId: string,
): string {
  return shopDomain ? `https://${shopDomain}/admin/products/${shopifyProductId}` : "#";
}

// Shows whether a product has been pushed to Shopify and whether it is
// published (Active) or unpublished (Draft) on Shopify, distinguishing it from
// the local Dockit status.
export function ShopifyStatusBadge({
  product,
  shopDomain,
}: {
  product: Product;
  shopDomain?: string | null;
}) {
  if (!product.shopifyProductId) {
    return (
      <Badge
        variant="outline"
        className="border-border text-muted-foreground font-normal text-xs py-0.5 whitespace-nowrap"
        title="Never pushed to Shopify (local only)"
      >
        Not pushed
      </Badge>
    );
  }

  const isPublished = product.status === "ACTIVE";
  const url = shopifyAdminProductUrl(shopDomain ?? null, product.shopifyProductId);

  return (
    <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {isPublished ? (
        <Badge
          className="border-transparent bg-success/10 text-success font-medium text-xs py-0.5"
          title="Active and published on Shopify"
        >
          Published
        </Badge>
      ) : (
        <Badge
          className="border-transparent bg-warning/10 text-warning font-medium text-xs py-0.5"
          title="Synced to Shopify as Draft (unpublished)"
        >
          Unpublished
        </Badge>
      )}
      {shopDomain && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground inline-flex items-center transition-colors p-0.5 rounded hover:bg-muted"
          title="Open in Shopify Admin"
        >
          <ExternalLink className="size-3 text-muted-foreground hover:text-foreground" />
        </a>
      )}
    </div>
  );
}
