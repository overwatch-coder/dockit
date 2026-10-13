"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStatusDistributionData } from "@/lib/analytics/dashboard";
import type { Product } from "@/types/product";

const chartConfig: ChartConfig = {
  active: {
    label: "Active",
    color: "var(--success, #22c55e)",
  },
  draft: {
    label: "Draft",
    color: "var(--warning, #f59e0b)",
  },
  conflict: {
    label: "Conflict",
    color: "var(--conflict, #a78bfa)",
  },
};

export function StatusDonutChart({ products }: { products: Product[] }) {
  const { summary, chartData } = useMemo(() => {
    return getStatusDistributionData(products);
  }, [products]);

  const activeSlices = useMemo(
    () => chartData.filter((item) => item.count > 0),
    [chartData]
  );

  return (
    <Card className="flex h-full flex-col justify-between">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Status Breakdown</CardTitle>
        <CardDescription className="text-xs">
          Catalog distribution across active, draft, and conflicted states
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col items-center justify-between gap-4 pb-5 pt-1">
        {/* Centered Donut Chart */}
        <div className="relative flex aspect-square h-40 w-40 shrink-0 items-center justify-center">
          <ChartContainer config={chartConfig} className="size-full">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="status"
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">{name}:</span>
                        <span className="font-mono font-medium text-foreground">
                          {value} ({summary.total > 0 ? Math.round((Number(value) / summary.total) * 100) : 0}%)
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Pie
                data={
                  activeSlices.length > 0
                    ? activeSlices
                    : [{ status: "Empty", count: 1, color: "var(--muted)" }]
                }
                dataKey="count"
                nameKey="status"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={activeSlices.length > 1 ? 3 : 0}
                strokeWidth={2}
                stroke="var(--card)"
              >
                {activeSlices.length > 0 ? (
                  activeSlices.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))
                ) : (
                  <Cell fill="var(--border)" opacity={0.4} />
                )}
              </Pie>
            </PieChart>
          </ChartContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
              {summary.total}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">Products</span>
          </div>
        </div>

        {/* Status List Cards - Full Width */}
        <div className="flex w-full flex-col gap-2 pt-1">
          {chartData.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3.5 py-2 text-xs transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-foreground">{item.status}</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="font-semibold text-foreground">{item.count}</span>
                <span className="text-[11px] text-muted-foreground">
                  ({item.percentage}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
