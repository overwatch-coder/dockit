// Unit 21: the server-side source of truth for "which store is active" —
// lib/store/active-store.ts's Zustand store mirrors this client-side for
// instant UI feedback, but every server component/action reads this cookie
// (via lib/db/stores.ts's getActiveStoreForAccount), never the Zustand
// value. Lives in its own module (not app/(dashboard)/stores/actions.ts)
// because "use server" files may only export async functions — a plain
// string const export there gets silently stripped by Next's build, leaving
// every importer with "no exports at all."
export const ACTIVE_STORE_COOKIE_NAME = "active-store-id";
