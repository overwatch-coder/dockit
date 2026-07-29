"use client";

import { useState } from "react";
import { ChevronsUpDown, Store as StoreIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

// Placeholder stores only — Unit 4 is a static layout, no Shopify data yet.
// Unit 7 (initial store import) replaces this with real connected stores.
const mockStores = [{ id: "mock-store-1", name: "My Shopify Store" }];

export function StoreSwitcher() {
  const [selectedStoreId, setSelectedStoreId] = useState(mockStores[0].id);
  const selectedStore = mockStores.find((store) => store.id === selectedStoreId)!;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg">
                <StoreIcon className="size-4" />
                <span className="truncate font-medium">{selectedStore.name}</span>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent className="w-[--radix-popper-anchor-width]">
            {mockStores.map((store) => (
              <DropdownMenuItem
                key={store.id}
                onClick={() => setSelectedStoreId(store.id)}
              >
                {store.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
