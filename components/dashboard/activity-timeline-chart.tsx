"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getActivityTimelineData } from "@/lib/analytics/dashboard";
import type { Product } from "@/types/product";

const chartConfig: ChartConfig = {
  synced: {
    label: "Synced with Shopify",
    color: "var(--primary, #6366f1)",
  },
  edited: {
    label: "Catalog Updates",
    color: "var(--conflict, #a78bfa)",
  },
};

export function ActivityTimelineChart({ products }: { products: Product[] }) {
  const [timeRange, setTimeRange] = useState<7 | 14 | 30>(14);

  const data = useMemo(() => {
    return getActivityTimelineData(products, timeRange);
  }, [products, timeRange]);

  const totalSynced = useMemo(
    () => data.reduce((acc, curr) => acc + curr.synced, 0),
    [data]
  );
  const totalEdited = useMemo(
    () => data.reduce((acc, curr) => acc + curr.edited, 0),
    [data]
  );

  return (
    <Card className="flex h-full flex-col justify-between">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">Catalog Activity</CardTitle>
          <CardDescription className="text-xs">
            Product synchronization and catalog modification events
          </CardDescription>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
          {([7, 14, 30] as const).map((days) => (
            <Button
              key={days}
              type="button"
              variant={timeRange === days ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTimeRange(days)}
              className="h-7 px-2.5 text-xs font-medium"
            >
              {days}d
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" />
            <span>
              Synced: <strong className="font-mono text-foreground">{totalSynced}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-conflict" />
            <span>
              Updated: <strong className="font-mono text-foreground">{totalEdited}</strong>
            </span>
          </div>
        </div>

        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="fillSynced" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-synced)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-synced)" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="fillEdited" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-edited)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-edited)" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={20}
              className="text-[11px]"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              className="text-[11px]"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(value) => `${value}`}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="synced"
              stroke="var(--color-synced)"
              strokeWidth={2}
              fill="url(#fillSynced)"
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Area
              type="monotone"
              dataKey="edited"
              stroke="var(--color-edited)"
              strokeWidth={1.75}
              fill="url(#fillEdited)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
