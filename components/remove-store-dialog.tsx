"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Database, Loader2, ShieldCheck } from "lucide-react";
import { disconnectStore, unlinkStore } from "@/app/(dashboard)/stores/actions";
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
import type { Store } from "@/types/store";

export function RemoveStoreDialog({
  store,
  onOpenChange,
}: {
  store: Store | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [deleteWithData, setDeleteWithData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!store) return;
    setError(null);
    startTransition(async () => {
      const result = deleteWithData
        ? await disconnectStore(store.id)
        : await unlinkStore(store.id);

      if (result?.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
    });
  };

  return (
    <AlertDialog
      open={store !== null}
      onOpenChange={(open) => {
        if (!open) {
          setError(null);
          setDeleteWithData(false);
          onOpenChange(false);
        }
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {deleteWithData
              ? `Delete ${store?.name ?? store?.shopifyDomain ?? "Store"}?`
              : `Unlink ${store?.name ?? store?.shopifyDomain ?? "Store"}?`}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2 text-left">
            {/* Shopify Store Untouched Notice */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-950 dark:text-blue-200 flex items-start gap-2.5">
              <ShieldCheck className="size-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <span className="font-semibold">Shopify Store Untouched:</span>
                <p className="mt-0.5 text-blue-900/80 dark:text-blue-300/80 leading-relaxed">
                  Data inside your Shopify store will <strong>not</strong> be deleted. Only credentials and connections in Dockit are modified.
                </p>
              </div>
            </div>

            {deleteWithData ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Permanent Deletion from Dockit:</span>
                  <p className="mt-0.5 text-destructive/80 leading-relaxed">
                    This permanently removes this store and purges all its products from your database.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2.5">
                <Database className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  <span className="font-semibold">Database Products Preserved:</span>
                  <p className="mt-0.5 text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed">
                    All products, variants, and AI settings stay safely in your Dockit database so you can link another store later and republish.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start space-x-3 rounded-lg border p-3 bg-muted/40 text-foreground">
              <Checkbox
                id="remove-store-delete-data"
                checked={deleteWithData}
                onCheckedChange={(checked) => setDeleteWithData(Boolean(checked))}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="remove-store-delete-data"
                  className="text-xs font-semibold cursor-pointer text-foreground"
                >
                  Also permanently delete all products from Dockit database
                </label>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Leave unchecked to keep products safe in your database for future stores.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="px-4 text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={deleteWithData ? "destructive" : "default"}
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1.5" />
                {deleteWithData ? "Deleting..." : "Unlinking..."}
              </>
            ) : deleteWithData ? (
              "Delete Store"
            ) : (
              "Unlink Store (Keep Data)"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
