import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { getStoresForAccount } from "@/lib/db/stores";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/product-form";

// Unit 10: creates a brand-new local-only draft product (no shopifyProductId
// until a future push — Units 15-17). Scoped to the first connected store,
// same as /products (Unit 21 wires real store-switcher selection later).
export default async function NewProductPage() {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const stores = await getStoresForAccount(account.id);

  if (stores.length === 0) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/products" />}>
          <ArrowLeft className="size-4" />
          Back to products
        </Button>
      </div>

      <h1 className="text-page-title font-semibold text-foreground">New product</h1>

      <ProductForm mode="create" storeId={stores[0].id} />
    </div>
  );
}
