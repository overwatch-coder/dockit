"use client";

import Link from "next/link";
import { ArrowUpRight, ExternalLink, RefreshCw, Settings, Store as StoreIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SyncStoreButton } from "@/components/sync-store-button";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { ActivityTimelineChart } from "@/components/dashboard/activity-timeline-chart";
import { StatusDonutChart } from "@/components/dashboard/status-donut-chart";
import { CategoryBarChart } from "@/components/dashboard/category-bar-chart";
import type { Product } from "@/types/product";
import type { Store } from "@/types/store";

const lastSyncedFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function DashboardOverview({
  store,
  products,
}: {
  store: Store;
  products: Product[];
}) {
  const lastSyncedAt = products.reduce<Date | null>((latest, product) => {
    if (!product.lastSyncedAt) return latest;
    if (!latest || product.lastSyncedAt > latest) return product.lastSyncedAt;
    return latest;
  }, null);

  const isConnected = Boolean(store.connectedAt && store.shopifyDomain);

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-3.5 sm:p-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{store.name ?? store.shopifyDomain ?? "Dockit Store"}</p>
        </div>
        <div className="flex items-center gap-3">
          <SyncStoreButton />
          <Button nativeButton={false} render={<Link href="/products" />} size="sm">
            View products
          </Button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <MetricsCards products={products} />

      {/* Analytics Charts Grid: Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityTimelineChart products={products} />
        </div>
        <div className="lg:col-span-1">
          <StatusDonutChart products={products} />
        </div>
      </div>

      {/* Analytics Charts Grid: Row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CategoryBarChart products={products} />
        </div>

        {/* Store Overview Card */}
        <div className="lg:col-span-1">
          <Card className="flex h-full flex-col justify-between border-border/80 bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground">
                  <StoreIcon className="size-4" />
                </div>
                <CardTitle className="text-base font-semibold">Store Connection</CardTitle>
              </div>
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  <span className="size-1.5 rounded-full bg-success animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                  <span className="size-1.5 rounded-full bg-warning" />
                  Not connected
                </span>
              )}
            </CardHeader>

            <CardContent className="flex flex-1 flex-col justify-between pt-2">
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Store Name</span>
                  <p className="font-medium text-foreground">{store.name ?? "—"}</p>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground">Shopify Domain</span>
                  {store.shopifyDomain ? (
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`https://${store.shopifyDomain}/admin`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-table-data text-primary hover:underline flex items-center gap-1"
                      >
                        {store.shopifyDomain}
                        <ExternalLink className="size-3 shrink-0" />
                      </Link>
                    </div>
                  ) : (
                    <p className="text-foreground">Not configured</p>
                  )}
                </div>

                <div>
                  <span className="text-xs text-muted-foreground">Last Synced</span>
                  <p className="font-mono text-table-data text-foreground">
                    {lastSyncedAt ? lastSyncedFormatter.format(lastSyncedAt) : "Never"}
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-border/60 pt-4 flex flex-col gap-2">
                {isConnected ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Link
                      href="/products"
                      className="flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      Browse catalog
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                    <Link
                      href="/settings"
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Settings className="size-3.5" />
                      Settings
                    </Link>
                  </div>
                ) : (
                  <Link
                    href="/settings"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    Connect Shopify Account in Settings →
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
