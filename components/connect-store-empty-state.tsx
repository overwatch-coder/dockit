"use client";

import { useState } from "react";
import { Store as StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectStoreDialog } from "@/components/connect-store-dialog";

export function ConnectStoreEmptyState() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 font-sans">
      <StoreIcon className="size-10 text-muted-foreground" />
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-section-heading font-semibold text-foreground">
          Connect your Shopify store
        </p>
        <p className="text-sm text-muted-foreground">
          Connect a store to start managing its products from Dockit.
        </p>
      </div>
      <Button onClick={() => setOpen(true)}>Connect store</Button>
      <ConnectStoreDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
