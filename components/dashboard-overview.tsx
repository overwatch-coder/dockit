import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SyncStoreButton } from "@/components/sync-store-button";
import type { Product } from "@/types/product";
import type { Store } from "@/types/store";

const lastSyncedFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-label font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-page-title font-semibold text-foreground">{value}</CardContent>
    </Card>
  );
}

// Unit 8: the dashboard is an at-a-glance overview of the current store, not
// where products are listed — that's /products. Scoped to the first
// connected store for now, same as the product list (Unit 21 wires real
// store-switcher selection later).
export function DashboardOverview({ store, products }: { store: Store; products: Product[] }) {
  const activeCount = products.filter((product) => product.status === "ACTIVE").length;
  const draftCount = products.filter((product) => product.status === "DRAFT").length;
  const conflictCount = products.filter((product) => product.isConflicted).length;
  const lastSyncedAt = products.reduce<Date | null>((latest, product) => {
    if (!product.lastSyncedAt) return latest;
    if (!latest || product.lastSyncedAt > latest) return product.lastSyncedAt;
    return latest;
  }, null);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title font-semibold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground">{store.name ?? store.shopifyDomain}</p>
        </div>
        <Button nativeButton={false} render={<Link href="/products" />}>
          View products
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total products" value={String(products.length)} />
        <StatCard label="Active" value={String(activeCount)} />
        <StatCard label="Draft" value={String(draftCount)} />
        <StatCard label="Conflicts" value={String(conflictCount)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Store</CardTitle>
            {store.connectedAt && store.shopifyDomain ? (
              <span className="inline-flex items-center rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                Not connected
              </span>
            )}
          </div>
          <SyncStoreButton />
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>
            Name: <span className="text-foreground">{store.name ?? "—"}</span>
          </p>
          <p>
            Domain:{" "}
            {store.shopifyDomain ? (
              <Link
                href={`https://${store.shopifyDomain}/admin`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-table-data text-primary hover:underline"
              >
                {store.shopifyDomain}
              </Link>
            ) : (
              <span className="text-foreground">Not configured</span>
            )}
          </p>
          <p>
            Last synced:{" "}
            <span className="font-mono text-table-data text-foreground">
              {lastSyncedAt ? lastSyncedFormatter.format(lastSyncedAt) : "Never"}
            </span>
          </p>
          {!store.connectedAt && (
            <div className="pt-2">
              <Link href="/settings" className="text-xs text-primary hover:underline font-medium">
                Connect your Shopify account in Settings →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
