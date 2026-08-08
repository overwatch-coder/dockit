import { create } from "zustand";

// First Zustand store in the repo — architecture.md's Stack table earmarks
// Zustand for "active store selection" client-side state (Unit 21). The
// cookie set by setActiveStore (app/(dashboard)/stores/actions.ts) remains
// the actual source of truth read by every server component/action; this
// store only mirrors that value client-side so components/store-switcher.tsx
// can update its trigger label/highlight instantly, without waiting on the
// server action + router.refresh() round-trip to complete.
type ActiveStoreState = {
  activeStoreId: string | null;
  setActiveStoreId: (id: string) => void;
};

export const useActiveStoreStore = create<ActiveStoreState>((set) => ({
  activeStoreId: null,
  setActiveStoreId: (id) => set({ activeStoreId: id }),
}));
