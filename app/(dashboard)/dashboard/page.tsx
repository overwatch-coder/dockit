import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { getActiveStoreForAccount, getStoresForAccount } from "@/lib/db/stores";
import { ACTIVE_STORE_COOKIE_NAME } from "@/lib/active-store-cookie";
import { getProductsForStore } from "@/lib/db/products";
import { AutoDismissBanner } from "@/components/auto-dismiss-banner";
import { ConnectStoreEmptyState } from "@/components/connect-store-empty-state";
import { DashboardOverview } from "@/components/dashboard-overview";

// Unit 8: the dashboard is an overview/analytics landing page (store status,
// product counts, a link into /products), not the product list itself — the
// real list lives at /products, per code-standards.md's existing
// app/(dashboard)/products/ reservation for product-related pages.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ storeError?: string }>;
}) {
  // Call protect() here too (not just a non-null assertion on the layout's
  // check) so a cold-start race that slips past the layout still redirects
  // instead of crashing on a null userId.
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const stores = await getStoresForAccount(account.id);
  const { storeError } = await searchParams;

  // Surfaces errors from app/api/shopify/oauth/callback/route.ts's
  // errorRedirect — that route can't render inline UI itself since it's an
  // external-caller redirect target, not a page. Auto-dismisses itself.
  const errorBanner = storeError && <AutoDismissBanner message={storeError} />;

  if (stores.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        {errorBanner && <div className="flex justify-center p-4">{errorBanner}</div>}
        <ConnectStoreEmptyState />
      </div>
    );
  }

  const cookieStoreId = (await cookies()).get(ACTIVE_STORE_COOKIE_NAME)?.value ?? null;
  const currentStore = getActiveStoreForAccount(stores, cookieStoreId)!;
  const products = await getProductsForStore(account.id, currentStore.id);

  return (
    <div className="flex flex-1 flex-col">
      {errorBanner && <div className="flex justify-center p-4">{errorBanner}</div>}
      <DashboardOverview store={currentStore} products={products} />
    </div>
  );
}
