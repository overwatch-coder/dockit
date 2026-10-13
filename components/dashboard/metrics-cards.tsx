import { AlertTriangle, CheckCircle2, FileEdit, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCatalogMetrics } from "@/lib/analytics/dashboard";
import type { Product } from "@/types/product";

export function MetricsCards({ products }: { products: Product[] }) {
  const metrics = getCatalogMetrics(products);

  const activePct =
    metrics.totalProducts > 0
      ? Math.round((metrics.activeCount / metrics.totalProducts) * 100)
      : 0;
  const draftPct =
    metrics.totalProducts > 0
      ? Math.round((metrics.draftCount / metrics.totalProducts) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card className="relative overflow-hidden border-border/80 bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-label font-medium text-muted-foreground">
            Total Products
          </CardTitle>
          <div className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground">
            <Package className="size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {metrics.totalProducts}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Across <span className="font-mono text-foreground font-medium">{metrics.totalVariants}</span> variant{metrics.totalVariants === 1 ? "" : "s"}
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-border/80 bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-label font-medium text-muted-foreground">
            Active
          </CardTitle>
          <div className="flex size-7 items-center justify-center rounded-md border border-success/30 bg-success/10 text-success">
            <CheckCircle2 className="size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {metrics.activeCount}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-mono text-success font-medium">{activePct}%</span> live on Shopify
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-border/80 bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-label font-medium text-muted-foreground">
            Drafts
          </CardTitle>
          <div className="flex size-7 items-center justify-center rounded-md border border-warning/30 bg-warning/10 text-warning">
            <FileEdit className="size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {metrics.draftCount}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-mono text-warning font-medium">{draftPct}%</span> staging in Dockit
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-border/80 bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-label font-medium text-muted-foreground">
            Conflicts
          </CardTitle>
          <div
            className={`flex size-7 items-center justify-center rounded-md border text-conflict ${
              metrics.conflictCount > 0
                ? "border-conflict/40 bg-conflict/15 text-conflict"
                : "border-border/60 bg-muted/40 text-muted-foreground"
            }`}
          >
            <AlertTriangle className="size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {metrics.conflictCount}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {metrics.conflictCount > 0 ? (
              <span className="font-medium text-conflict">Requires field resolution</span>
            ) : (
              <span className="text-muted-foreground">Zero sync conflicts</span>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
