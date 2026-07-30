import { Badge } from "@/components/ui/badge";
import type { Product } from "@/types/product";

// Shared by the product list (components/product-table.tsx) and the product
// editor (app/(dashboard)/products/[id]/page.tsx) — no interactivity, so it
// works in both a client and a server component without a "use client"
// boundary of its own. Reads isConflicted first, per ui-context.md's three
// named states (Draft/Active/Conflict).
export function ProductStatusBadge({ product }: { product: Product }) {
  if (product.isConflicted) {
    return <Badge className="border-transparent bg-conflict/10 text-conflict">Conflict</Badge>;
  }
  if (product.status === "ACTIVE") {
    return <Badge className="border-transparent bg-success/10 text-success">Active</Badge>;
  }
  return <Badge className="border-transparent bg-warning/10 text-warning">Draft</Badge>;
}
