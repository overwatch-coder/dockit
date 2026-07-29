"use client";

import { connectStore } from "@/app/(dashboard)/stores/actions";
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

export function ConnectStoreDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect your Shopify store</DialogTitle>
          <DialogDescription>
            Enter your store&apos;s myshopify.com domain. You&apos;ll be redirected to Shopify
            to approve the connection.
          </DialogDescription>
        </DialogHeader>
        <form action={connectStore} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="shopDomain">Store domain</Label>
            <Input
              id="shopDomain"
              name="shopDomain"
              placeholder="your-store.myshopify.com"
              autoComplete="off"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit">Connect store</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
