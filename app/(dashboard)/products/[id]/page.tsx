import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import DOMPurify from "isomorphic-dompurify";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { getProductById } from "@/lib/db/products";
import { Button } from "@/components/ui/button";
import { ProductStatusBadge } from "@/components/product-status-badge";

// Force any link in a description to open safely in a new tab, per
// DOMPurify's own documented recipe for this — done once at module scope
// since the hook is registered on the shared DOMPurify instance.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

const DESCRIPTION_ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "a", "span",
];

// Shopify's descriptionHtml is stored as-is (lib/shopify/products.ts) and
// isn't guaranteed sanitized — rendering it directly via
// dangerouslySetInnerHTML would be an XSS risk. Sanitized with DOMPurify
// (isomorphic-dompurify, safe in a server component with no DOM) against a
// tight allowlist so real formatting (headings, lists, bold, links) still
// renders correctly, rather than flattening everything to plain text.
function sanitizeDescription(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: DESCRIPTION_ALLOWED_TAGS,
    ALLOWED_ATTR: ["href"],
  });
}

// Unit 9: read-only core fields (title, description, price, status) for a
// single product. No save, no variants, no images, no AI yet — those are
// Units 10/11/12/14. Row click and the product list's Edit action both land
// here (components/product-table.tsx).
export default async function ProductEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const { id } = await params;

  const product = await getProductById(account.id, id);
  if (!product) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/products" />}>
          <ArrowLeft className="size-4" />
          Back to products
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-page-title font-semibold text-foreground">{product.title}</h1>
        <ProductStatusBadge product={product} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-label font-medium text-muted-foreground">Price</span>
        <span className="font-mono text-table-data text-foreground">{product.price}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-label font-medium text-muted-foreground">Description</span>
        {product.description ? (
          <div
            className="text-sm text-foreground [&_a]:text-primary [&_a]:underline [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: sanitizeDescription(product.description) }}
          />
        ) : (
          <span className="text-sm text-muted-foreground">No description</span>
        )}
      </div>
    </div>
  );
}
