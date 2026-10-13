"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { exportProductsCsv } from "@/app/(dashboard)/products/actions";
import { Button } from "@/components/ui/button";

type StatusFilter = "all" | "DRAFT" | "ACTIVE" | "CONFLICT";

// The server action returns the CSV as plain text, and this client-side helper
// triggers a browser file download.
function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Lives in the product table's filter row (components/product-table.tsx)
// reading active search/status/category filters and exporting all matching products.
export function ExportCsvButton({
  search,
  statusFilter,
  categoryFilter,
}: {
  search: string;
  statusFilter: StatusFilter;
  categoryFilter: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const result = await exportProductsCsv({ search, statusFilter, categoryFilter });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      downloadCsv(result.csv, `products-${date}.csv`);
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleExport}>
      <Download className="size-4" />
      {isPending ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
