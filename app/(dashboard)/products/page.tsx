import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { getStoresForAccount } from "@/lib/db/stores";
import { getPaginatedProductsForStore, getProductSummariesForStore, getStoreCategories } from "@/lib/db/products";
import { Button } from "@/components/ui/button";
import { ProductTable } from "@/components/product-table";
import { PushAllDraftsButton } from "@/components/push-all-drafts-button";
import { SyncStoreButton } from "@/components/sync-store-button";

// Unit 8: real product list, read-only. Scoped to the first connected store
// for now — Unit 21 wires this to the store switcher's actual selection.
// No store connected is handled by redirecting to /dashboard, since that's
// where the "Connect store" entry points live (Unit 5) — this page doesn't
// duplicate that empty state.
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
    category?: string;
  }>;
}) {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const stores = await getStoresForAccount(account.id);

  if (stores.length === 0) {
    redirect("/dashboard");
  }

  const currentStore = stores[0];
  const params = await searchParams;

  const rawPage = params.page ? parseInt(params.page, 10) : 1;
  const page = isNaN(rawPage) ? 1 : rawPage;
  const pageSizeOption = params.pageSize === "all" ? "all" : (params.pageSize ? parseInt(params.pageSize, 10) : 25);
  const pageSize = typeof pageSizeOption === "number" && isNaN(pageSizeOption) ? 25 : pageSizeOption;
  const search = params.search ?? "";
  const statusFilter = (params.status ?? "all") as "all" | "DRAFT" | "ACTIVE" | "CONFLICT";
  const categoryFilter = params.category ?? "all";

  // productSummaries is a lightweight {id, title, shopifyProductId,
  // isConflicted} projection across the *whole* catalog (not just the
  // current page) — enough for PushAllDraftsButton's unsynced count and
  // ProductTable's productTitles/pushableSelectedIds maps, without paying
  // for the full Product shape (variants, description, images) that
  // getProductsForStore fetches. The paginated table itself only ever needs
  // one page of full records, from getPaginatedProductsForStore below.
  const [paginatedResult, categories, productSummaries] = await Promise.all([
    getPaginatedProductsForStore(account.id, currentStore.id, {
      page,
      pageSize,
      search,
      statusFilter,
      categoryFilter,
    }),
    getStoreCategories(account.id, currentStore.id),
    getProductSummariesForStore(account.id, currentStore.id),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title font-semibold text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground">
            {currentStore.name ?? currentStore.shopifyDomain}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncStoreButton />
          <PushAllDraftsButton products={productSummaries} />
          <Button nativeButton={false} render={<Link href="/products/new" />}>
            <Plus className="size-4" />
            New product
          </Button>
        </div>
      </div>
      {paginatedResult.totalCount === 0 && !search && statusFilter === "all" && categoryFilter === "all" ? (
        <p className="text-sm text-muted-foreground">No products yet.</p>
      ) : (
        <ProductTable
          paginatedResult={paginatedResult}
          categories={categories}
          shopDomain={currentStore.shopifyDomain}
          initialSearch={search}
          initialStatusFilter={statusFilter}
          initialCategoryFilter={categoryFilter}
          allProducts={productSummaries}
        />
      )}
    </div>
  );
}
