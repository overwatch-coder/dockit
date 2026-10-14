import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/types/product";

function shopifyAdminProductUrl(
  shopDomain: string | null,
  shopifyProductId: string,
): string {
  return shopDomain ? `https://${shopDomain}/admin/products/${shopifyProductId}` : "#";
}

// Shows whether a product exists in Shopify (Published) or was created locally
// without being synced to Shopify yet (Not published).
export function ShopifyStatusBadge({
  product,
  shopDomain,
}: {
  product: Product;
  shopDomain?: string | null;
}) {
  if (product.shopifyProductId) {
    const url = shopifyAdminProductUrl(shopDomain ?? null, product.shopifyProductId);
    return (
      <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Badge
          className="border-transparent bg-success/10 text-success font-medium text-xs py-0.5"
          title="Synced and published on Shopify"
        >
          Published
        </Badge>
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

  return (
    <Badge
      variant="outline"
      className="border-border text-muted-foreground font-normal text-xs py-0.5 whitespace-nowrap"
      title="Not synced to Shopify"
    >
      Not published
    </Badge>
  );
}
