"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { disconnectStore } from "@/app/(dashboard)/stores/actions";
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
import type { Store } from "@/types/store";

export function RemoveStoreDialog({
  store,
  onOpenChange,
}: {
  store: Store | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!store) return;
    setError(null);
    startTransition(async () => {
      const result = await disconnectStore(store.id);
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
          onOpenChange(false);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {store?.name ?? store?.shopifyDomain}?</AlertDialogTitle>
          <AlertDialogDescription>
            This disconnects the store from Dockit and deletes its locally stored data. Shopify
            itself is unaffected, and you can reconnect it later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="px-4 text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleConfirm}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Removing...
              </>
            ) : (
              "Remove store"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
