"use client";

import { useActionState, useEffect, useState } from "react";
import { connectStore } from "@/app/(dashboard)/stores/actions";
import { ConnectStoreSubmitButton } from "@/components/connect-store-submit-button";
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

// Mounts fresh (via a `key` tied to each new action result) so its own
// dismiss timer always starts from 0, even for the same error message twice
// in a row. setVisible(false) only ever runs inside the setTimeout
// callback, never synchronously in the effect body.
function DialogError({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

export function ConnectStoreDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction] = useActionState(connectStore, undefined);

  // useActionState returns a new `state` object every time the action
  // resolves. Adjusting state during render (not in an effect) is the
  // React-endorsed way to derive a fresh key from that without an extra
  // setState-in-effect: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevState, setPrevState] = useState(state);
  const [errorKey, setErrorKey] = useState(0);
  if (state !== prevState) {
    setPrevState(state);
    setErrorKey((key) => key + 1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect your Shopify store</DialogTitle>
          <DialogDescription>
            Enter your store name, its myshopify.com domain, or the full admin URL.
            You&apos;ll be redirected to Shopify to approve the connection.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="shopDomain">Store domain</Label>
            <Input
              id="shopDomain"
              name="shopDomain"
              placeholder="your-store or your-store.myshopify.com"
              autoComplete="off"
              required
            />
            {state?.error && <DialogError key={errorKey} message={state.error} />}
          </div>
          <DialogFooter>
            <ConnectStoreSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
