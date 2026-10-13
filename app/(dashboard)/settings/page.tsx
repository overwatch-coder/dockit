import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { ShieldCheck, Store } from "lucide-react";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { getActiveStoreForAccount, getStoresForAccount, getStoreCredentials } from "@/lib/db/stores";
import { ACTIVE_STORE_COOKIE_NAME } from "@/lib/active-store-cookie";
import { ShopifyCredentialsForm } from "@/components/shopify-credentials-form";
import { StoreAiRulesForm } from "@/components/store-ai-rules-form";
import { getAiRulesForStore, hasCustomAiRules } from "@/lib/db/ai-rules";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata = {
  title: "Settings - Dockit",
  description: "Manage your store configuration, Shopify connection, and AI generation rules.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; oauthError?: string; tab?: string }>;
}) {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const stores = await getStoresForAccount(account.id);
  const cookieStoreId = (await cookies()).get(ACTIVE_STORE_COOKIE_NAME)?.value ?? null;
  const currentStore = getActiveStoreForAccount(stores, cookieStoreId);
  const { connected, oauthError, tab } = await searchParams;

  if (!currentStore) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <h2 className="text-lg font-semibold">No store selected</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create or select a store using the sidebar switcher to configure its Shopify connection and AI rules.
        </p>
      </div>
    );
  }

  const [credentials, aiRules, isCustomRules] = await Promise.all([
    getStoreCredentials(account.id, currentStore.id),
    getAiRulesForStore(account.id, currentStore.id),
    hasCustomAiRules(account.id, currentStore.id),
  ]);

  const defaultTab = tab ?? "credentials";
  const storeDisplayName = currentStore.name ?? currentStore.shopifyDomain ?? "Untitled Store";

  return (
    <div className="flex flex-1 flex-col p-3.5 sm:p-6 space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Manage Shopify credentials, store connection status, and AI catalog generation rules.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md h-9 p-1">
          <TabsTrigger value="credentials" className="text-xs sm:text-sm gap-2">
            <ShieldCheck className="size-3.5 sm:size-4" />
            <span>Shopify Credentials</span>
          </TabsTrigger>
          <TabsTrigger value="store" className="text-xs sm:text-sm gap-2">
            <Store className="size-3.5 sm:size-4" />
            <span>Store Information</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credentials" className="space-y-6">
          <ShopifyCredentialsForm
            storeId={currentStore.id}
            storeName={storeDisplayName}
            initialCredentials={credentials}
            oauthResult={connected}
            oauthError={oauthError}
          />
        </TabsContent>

        <TabsContent value="store" className="space-y-6">
          <StoreAiRulesForm
            storeId={currentStore.id}
            storeName={storeDisplayName}
            initialRules={aiRules}
            isCustomizedInitial={isCustomRules}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
