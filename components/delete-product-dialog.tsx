"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { deleteProducts } from "@/app/(dashboard)/products/actions";
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

// Shared by both the single-row Delete action and the bulk selection bar —
// productIds is always an array, label is what the confirm copy calls it
// ("Adu Denim Shirt" for one, "3 products" for a bulk selection).
export function DeleteProductDialog({
  productIds,
  label,
  onOpenChange,
  onDeleted,
}: {
  productIds: string[] | null;
  label: string;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!productIds || productIds.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteProducts(productIds);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onDeleted?.();
      onOpenChange(false);
    });
  };

  return (
    <AlertDialog
      open={productIds !== null && productIds.length > 0}
      onOpenChange={(open) => {
        if (!open) {
          setError(null);
          onOpenChange(false);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {productIds && productIds.length > 1 ? "these products" : "this product"}{" "}
            from Dockit&apos;s database only — it does not delete anything on Shopify. If the
            store is synced again later, a product that still exists on Shopify will simply
            reappear.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="px-4 text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleConfirm}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
