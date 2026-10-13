"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategoryBreakdownData } from "@/lib/analytics/dashboard";
import type { Product } from "@/types/product";

const chartConfig: ChartConfig = {
  count: {
    label: "Products",
    color: "var(--primary, #6366f1)",
  },
};

export function CategoryBarChart({ products }: { products: Product[] }) {
  const data = useMemo(() => {
    return getCategoryBreakdownData(products, 6);
  }, [products]);

  return (
    <Card className="flex h-full flex-col justify-between">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Top Categories</CardTitle>
        <CardDescription className="text-xs">
          Product distribution across Shopify taxonomy categories and collections
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {data.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
            <p className="font-medium">No category data available</p>
            <p>Categories will be mapped when products are imported.</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                className="text-[11px]"
              />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={90}
                className="text-[11px] font-medium"
                tickFormatter={(value: string) =>
                  value.length > 13 ? `${value.slice(0, 12)}…` : value
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => (
                      <div className="flex w-full items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">{item.payload?.name}:</span>
                        <span className="font-mono font-medium text-foreground">
                          {value} ({item.payload?.percentage}%)
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[0, 4, 4, 0]}
                barSize={18}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
