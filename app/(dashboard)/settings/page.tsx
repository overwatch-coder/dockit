import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { getActiveStoreForAccount, getStoresForAccount, getStoreCredentials } from "@/lib/db/stores";
import { ACTIVE_STORE_COOKIE_NAME } from "@/lib/active-store-cookie";
import { ShopifyCredentialsForm } from "@/components/shopify-credentials-form";

export const metadata = {
  title: "Settings - Dockit",
  description: "Manage your store configuration and Shopify connection.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; oauthError?: string }>;
}) {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const stores = await getStoresForAccount(account.id);
  const cookieStoreId = (await cookies()).get(ACTIVE_STORE_COOKIE_NAME)?.value ?? null;
  const currentStore = getActiveStoreForAccount(stores, cookieStoreId);
  const { connected, oauthError } = await searchParams;

  if (!currentStore) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <h2 className="text-lg font-semibold">No store selected</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create or select a store using the sidebar switcher to configure its Shopify connection.
        </p>
      </div>
    );
  }

  const credentials = await getStoreCredentials(account.id, currentStore.id);

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your Shopify store credentials and manage store integrations.
        </p>
      </div>

      <ShopifyCredentialsForm
        storeId={currentStore.id}
        storeName={currentStore.name ?? currentStore.shopifyDomain ?? "Untitled Store"}
        initialCredentials={credentials}
        oauthResult={connected}
        oauthError={oauthError}
      />
    </div>
  );
}
