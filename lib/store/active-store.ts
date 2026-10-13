import { create } from "zustand";

// Client-side Zustand store for active store selection. The cookie set by
// setActiveStore (app/(dashboard)/stores/actions.ts) remains the actual source
// of truth read by server components and actions; this store mirrors that
// value client-side so components/store-switcher.tsx can update its trigger
// label and highlight instantly without waiting on the server action round-trip.
type ActiveStoreState = {
  activeStoreId: string | null;
  setActiveStoreId: (id: string) => void;
};

export const useActiveStoreStore = create<ActiveStoreState>((set) => ({
  activeStoreId: null,
  setActiveStoreId: (id) => set({ activeStoreId: id }),
}));
