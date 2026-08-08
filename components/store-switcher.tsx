"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Store as StoreIcon, Trash2 } from "lucide-react";
import { setActiveStore } from "@/app/(dashboard)/stores/actions";
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
import { useActiveStoreStore } from "@/lib/store/active-store";
import type { Store } from "@/types/store";

function displayName(store: Store): string {
  return store.name ?? store.shopifyDomain;
}

// Unit 21: activeStoreId is the server-resolved active store (cookie-backed,
// read in components/app-sidebar.tsx) — the authoritative default on every
// render. useActiveStoreStore (lib/store/active-store.ts) only holds a
// *pending optimistic* pick made this session: null until the owner clicks
// a different store, at which point it wins over the prop so the trigger
// label/highlight update instantly, without waiting on the server action +
// router.refresh() round-trip below to finish. No useEffect/hydration dance
// needed — both starting values are null/prop on server and first client
// render, so there's nothing to reconcile.
export function StoreSwitcher({ stores, activeStoreId }: { stores: Store[]; activeStoreId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const optimisticStoreId = useActiveStoreStore((state) => state.activeStoreId);
  const setOptimisticStoreId = useActiveStoreStore((state) => state.setActiveStoreId);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [storeToRemove, setStoreToRemove] = useState<Store | null>(null);

  const selectedStoreId = optimisticStoreId ?? activeStoreId ?? stores[0]?.id;
  const selectedStore = stores.find((store) => store.id === selectedStoreId);

  function handleSelectStore(store: Store) {
    if (store.id === selectedStoreId) {
      return;
    }
    setOptimisticStoreId(store.id);
    startTransition(async () => {
      await setActiveStore(store.id);
      // /products/[id] and /products/new are tied to one specific store —
      // stay on them after switching and they'd keep showing a product/form
      // that belongs to the store just switched away from, which
      // contradicts ui-context.md's "re-scopes the entire main content
      // area." Everywhere else, router.refresh() alone re-runs the server
      // components under the current route against the new cookie.
      if (/^\/products\/[^/]+$/.test(pathname)) {
        router.push("/products");
      } else {
        router.refresh();
      }
    });
  }

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
                onClick={() => handleSelectStore(store)}
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
