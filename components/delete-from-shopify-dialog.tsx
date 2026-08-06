"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { deleteProductEverywhere } from "@/app/(dashboard)/products/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useJobPolling } from "@/lib/hooks/use-job-polling";

// Unit 16 follow-up, per explicit user request: the products table's plain
// "Delete" (components/delete-product-dialog.tsx) only ever removes a
// product from Dockit's own database — safe, fast, and reversible via a
// future re-sync. This is a deliberately separate, much more dangerous
// action: it permanently deletes the product from Shopify too, so it's
// gated behind typing the product's exact title (same "type to confirm"
// pattern GitHub/Vercel use for destructive actions) rather than a plain
// Yes/No. Single product only — there's no one name to type-match against
// for a bulk selection, so this isn't offered from the toolbar.
export function DeleteFromShopifyDialog({
  product,
  onOpenChange,
  onDeleted,
}: {
  product: { id: string; title: string } | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [isEnqueuing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { isPolling, start } = useJobPolling({
    onSettled: (status, results) => {
      if (status === "SUCCEEDED") {
        setConfirmText("");
        setError(null);
        onOpenChange(false);
        onDeleted();
      } else {
        const parsed = results as { error?: string } | undefined;
        setError(parsed?.error ?? "Delete failed");
      }
    },
    onError: (message) => setError(message),
  });

  const isBusy = isEnqueuing || isPolling;
  const isMatch = product !== null && confirmText === product.title;

  function handleConfirm() {
    if (!product) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteProductEverywhere(product.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      start(result.jobId);
    });
  }

  return (
    <AlertDialog
      open={product !== null}
      onOpenChange={(open) => {
        if (!open && !isBusy) {
          setConfirmText("");
          setError(null);
          onOpenChange(false);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{product?.title}&quot; from Shopify?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the product from Shopify — your storefront and admin — and
            from Dockit. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 px-1">
          <Label htmlFor="delete-shopify-confirm" className="text-sm text-muted-foreground">
            Type <span className="font-medium text-foreground">{product?.title}</span> to confirm.
          </Label>
          <Input
            id="delete-shopify-confirm"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            autoComplete="off"
            disabled={isBusy}
          />
        </div>
        {error && <p className="px-1 text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={!isMatch || isBusy} onClick={handleConfirm}>
            {isBusy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete from Shopify"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
