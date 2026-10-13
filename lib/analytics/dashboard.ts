import type { Product } from "@/types/product";

export type ActivityDataPoint = {
  date: string;
  label: string;
  synced: number;
  edited: number;
};

export type CategoryDataPoint = {
  name: string;
  count: number;
  percentage: number;
};

export type StatusChartDataPoint = {
  status: string;
  key: "active" | "draft" | "conflict";
  count: number;
  percentage: number;
  color: string;
};

export type StatusDistribution = {
  summary: {
    total: number;
    active: number;
    draft: number;
    conflict: number;
  };
  chartData: StatusChartDataPoint[];
};

export type CatalogMetrics = {
  totalProducts: number;
  activeCount: number;
  draftCount: number;
  conflictCount: number;
  totalVariants: number;
  totalInventory: number;
  averagePrice: number;
};

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getActivityTimelineData(
  products: Product[],
  days = 14,
  referenceDate?: Date
): ActivityDataPoint[] {
  const ref = referenceDate ?? new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  // Build the list of target day keys in chronological order
  const dayKeys: { key: string; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(ref.getTime() - i * dayMs);
    const key = toUtcDayKey(d);
    const label = shortDateFormatter.format(d);
    dayKeys.push({ key, label });
  }

  // Pre-index product sync and edit counts by UTC date key
  const syncedCounts: Record<string, number> = {};
  const editedCounts: Record<string, number> = {};

  for (const product of products) {
    if (product.lastSyncedAt) {
      const sKey = toUtcDayKey(new Date(product.lastSyncedAt));
      syncedCounts[sKey] = (syncedCounts[sKey] ?? 0) + 1;
    }
    if (product.lastEditedAt) {
      const eKey = toUtcDayKey(new Date(product.lastEditedAt));
      editedCounts[eKey] = (editedCounts[eKey] ?? 0) + 1;
    }
  }

  return dayKeys.map(({ key, label }) => ({
    date: key,
    label,
    synced: syncedCounts[key] ?? 0,
    edited: editedCounts[key] ?? 0,
  }));
}

export function getCategoryBreakdownData(
  products: Product[],
  maxCategories = 6
): CategoryDataPoint[] {
  if (products.length === 0) return [];

  const counts: Record<string, number> = {};

  for (const product of products) {
    let name: string = "Uncategorized";
    if (product.categoryFullName) {
      name = product.categoryFullName.split(" > ").pop()?.trim() || product.categoryFullName;
    } else if (product.collectionTitle) {
      name = product.collectionTitle.trim();
    }
    counts[name] = (counts[name] ?? 0) + 1;
  }

  const sorted = Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / products.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  return sorted.slice(0, maxCategories);
}

export function getStatusDistributionData(products: Product[]): StatusDistribution {
  let active = 0;
  let draft = 0;
  let conflict = 0;

  for (const product of products) {
    if (product.isConflicted) {
      conflict++;
    } else if (product.status === "ACTIVE") {
      active++;
    } else {
      draft++;
    }
  }

  const total = products.length;
  const pct = (val: number) => (total > 0 ? Math.round((val / total) * 100) : 0);

  const chartData: StatusChartDataPoint[] = [
    {
      status: "Active",
      key: "active",
      count: active,
      percentage: pct(active),
      color: "var(--success, #22c55e)",
    },
    {
      status: "Draft",
      key: "draft",
      count: draft,
      percentage: pct(draft),
      color: "var(--warning, #f59e0b)",
    },
    {
      status: "Conflict",
      key: "conflict",
      count: conflict,
      percentage: pct(conflict),
      color: "var(--conflict, #a78bfa)",
    },
  ];

  return {
    summary: { total, active, draft, conflict },
    chartData,
  };
}

export function getCatalogMetrics(products: Product[]): CatalogMetrics {
  const { summary } = getStatusDistributionData(products);

  let totalVariants = 0;
  let totalInventory = 0;
  let totalPriceSum = 0;

  for (const product of products) {
    const numericPrice = parseFloat(product.price) || 0;
    totalPriceSum += numericPrice;

    if (product.variants && product.variants.length > 0) {
      totalVariants += product.variants.length;
      for (const v of product.variants) {
        totalInventory += v.inventory ?? 0;
      }
    } else {
      totalVariants += 1;
    }
  }

  const averagePrice =
    products.length > 0 ? Math.round((totalPriceSum / products.length) * 100) / 100 : 0;

  return {
    totalProducts: summary.total,
    activeCount: summary.active,
    draftCount: summary.draft,
    conflictCount: summary.conflict,
    totalVariants,
    totalInventory,
    averagePrice,
  };
}
