import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { getStoresForAccount } from "@/lib/db/stores";
import { getProductsForStore } from "@/lib/db/products";
import { ProductTable } from "@/components/product-table";

// Unit 8: real product list, read-only. Scoped to the first connected store
// for now — Unit 21 wires this to the store switcher's actual selection.
// No store connected is handled by redirecting to /dashboard, since that's
// where the "Connect store" entry points live (Unit 5) — this page doesn't
// duplicate that empty state.
export default async function ProductsPage() {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const stores = await getStoresForAccount(account.id);

  if (stores.length === 0) {
    redirect("/dashboard");
  }

  const currentStore = stores[0];
  const products = await getProductsForStore(account.id, currentStore.id);

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div>
        <h1 className="text-page-title font-semibold text-foreground">Products</h1>
        <p className="text-sm text-muted-foreground">
          {currentStore.name ?? currentStore.shopifyDomain}
        </p>
      </div>
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet.</p>
      ) : (
        <ProductTable products={products} />
      )}
    </div>
  );
}
