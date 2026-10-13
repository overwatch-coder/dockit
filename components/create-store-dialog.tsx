"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createStoreAction } from "@/app/(dashboard)/stores/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveStoreStore } from "@/lib/store/active-store";

export function CreateStoreDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const setOptimisticStoreId = useActiveStoreStore((state) => state.setActiveStoreId);
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isPending) {
      if (!nextOpen) {
        setStoreName("");
        setError(null);
      }
      onOpenChange(nextOpen);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = storeName.trim();
    if (!cleanName) {
      setError("Please enter a store name.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createStoreAction(cleanName);
      if (!result.success) {
        setError(result.error);
        return;
      }

      setOptimisticStoreId(result.storeId);
      setStoreName("");
      onOpenChange(false);
      router.push("/settings");
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new store</DialogTitle>
          <DialogDescription>
            Give your store a name to get started. You can connect your Shopify account in
            Settings afterwards.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-store-name">Store name</Label>
            <Input
              id="create-store-name"
              name="storeName"
              placeholder="e.g. My Awesome Store"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              autoComplete="off"
              disabled={isPending}
              autoFocus
              required
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create store
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
