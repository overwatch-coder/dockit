import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { getActiveStoreForAccount, getStoresForAccount } from "@/lib/db/stores";
import { ACTIVE_STORE_COOKIE_NAME } from "@/lib/active-store-cookie";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/product-form";

// Creates a brand-new local-only draft product (no shopifyProductId
// until pushed to Shopify). Scoped to the active store.
export default async function NewProductPage() {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const stores = await getStoresForAccount(account.id);

  if (stores.length === 0) {
    redirect("/dashboard");
  }

  const cookieStoreId = (await cookies()).get(ACTIVE_STORE_COOKIE_NAME)?.value ?? null;
  const activeStore = getActiveStoreForAccount(stores, cookieStoreId)!;

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-3.5 sm:p-6">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/products" />}>
          <ArrowLeft className="size-4" />
          Back to products
        </Button>
      </div>

      <h1 className="text-page-title font-semibold text-foreground">New product</h1>

      <ProductForm mode="create" storeId={activeStore.id} />
    </div>
  );
}
