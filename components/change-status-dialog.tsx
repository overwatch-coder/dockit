"use client";

import { useState, useTransition } from "react";
import { setProductsStatus } from "@/app/(dashboard)/products/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProductStatus } from "@/types/product";

// Unit 16 follow-up, per explicit user request: changes a product's status
// (or a bulk selection's) directly from the products list — a single row's
// dropdown, or the selection toolbar — with an explicit confirmation before
// anything happens, and an explicit choice of whether to also push that
// change to Shopify right now (matches the app's existing "nothing reaches
// Shopify without the owner asking for it" convention — same as the
// editor's own Save-vs-Push split). Shared between both call sites in
// components/product-table.tsx, same pattern as DeleteProductDialog.
export function ChangeStatusDialog({
  target,
  onOpenChange,
  onLocalUpdate,
  onSyncStarted,
}: {
  target: { ids: string[]; label: string; targetStatus: ProductStatus } | null;
  onOpenChange: (open: boolean) => void;
  onLocalUpdate: (count: number) => void;
  onSyncStarted: (jobId: string, count: number) => void;
}) {
  const [syncToShopify, setSyncToShopify] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const statusLabel = target?.targetStatus === "ACTIVE" ? "Active" : "Draft";

  function handleConfirm() {
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const result = await setProductsStatus(target.ids, target.targetStatus, syncToShopify);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.jobId) {
        onSyncStarted(result.jobId, result.count);
      } else {
        onLocalUpdate(result.count);
      }
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) {
          setError(null);
          setSyncToShopify(true);
          onOpenChange(false);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Set {target?.label} to {statusLabel}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {target?.targetStatus === "ACTIVE"
              ? "Active products are visible and purchasable on your storefront once synced."
              : "Draft products are hidden from customers once synced."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-center gap-2 px-1 text-sm text-foreground">
          <Checkbox
            checked={syncToShopify}
            onCheckedChange={(checked) => setSyncToShopify(checked === true)}
          />
          Sync this change to Shopify now
        </label>
        {error && <p className="px-1 text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={handleConfirm}>
            {isPending ? "Updating..." : syncToShopify ? `Set ${statusLabel} & sync` : `Set ${statusLabel}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
