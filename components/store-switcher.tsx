"use client";

import { useState } from "react";
import { ChevronsUpDown, Plus, Store as StoreIcon } from "lucide-react";
import { ConnectStoreDialog } from "@/components/connect-store-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { Store } from "@/types/store";

export function StoreSwitcher({ stores }: { stores: Store[] }) {
  const [selectedStoreId, setSelectedStoreId] = useState(stores[0]?.id);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const selectedStore = stores.find((store) => store.id === selectedStoreId);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg">
                <StoreIcon className="size-4" />
                <span className="truncate font-medium">
                  {selectedStore ? selectedStore.shopifyDomain : "No store connected"}
                </span>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent className="w-[--radix-popper-anchor-width]">
            {stores.map((store) => (
              <DropdownMenuItem
                key={store.id}
                onClick={() => setSelectedStoreId(store.id)}
              >
                {store.shopifyDomain}
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
    </SidebarMenu>
  );
}
