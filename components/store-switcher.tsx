"use client";

import { useState } from "react";
import { ChevronsUpDown, Plus, Store as StoreIcon, Trash2 } from "lucide-react";
import { ConnectStoreDialog } from "@/components/connect-store-dialog";
import { RemoveStoreDialog } from "@/components/remove-store-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { Store } from "@/types/store";

function displayName(store: Store): string {
  return store.name ?? store.shopifyDomain;
}

export function StoreSwitcher({ stores }: { stores: Store[] }) {
  const [selectedStoreId, setSelectedStoreId] = useState(stores[0]?.id);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [storeToRemove, setStoreToRemove] = useState<Store | null>(null);
  const selectedStore = stores.find((store) => store.id === selectedStoreId);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="group-data-[collapsible=icon]:p-2!"
              >
                <StoreIcon className="size-4" />
                <span className="truncate font-medium">
                  {selectedStore ? displayName(selectedStore) : "No store connected"}
                </span>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent className="w-[--radix-popper-anchor-width]">
            {stores.map((store) => (
              <DropdownMenuItem
                key={store.id}
                className="justify-between"
                onClick={() => setSelectedStoreId(store.id)}
              >
                <span className="truncate">{displayName(store)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${displayName(store)}`}
                  className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    setStoreToRemove(store);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
            {stores.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => setConnectDialogOpen(true)}>
              <Plus className="size-4" />
              Connect store
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <ConnectStoreDialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen} />
      <RemoveStoreDialog
        store={storeToRemove}
        onOpenChange={(open) => {
          if (!open) setStoreToRemove(null);
        }}
      />
    </SidebarMenu>
  );
}
