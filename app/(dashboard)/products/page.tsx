import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { getActiveStoreForAccount, getStoresForAccount } from "@/lib/db/stores";
import { ACTIVE_STORE_COOKIE_NAME } from "@/lib/active-store-cookie";
import { getPaginatedProductsForStore, getProductSummariesForStore, getStoreCategories } from "@/lib/db/products";
import { getAiRulesForStore } from "@/lib/db/ai-rules";
import { Button } from "@/components/ui/button";
import { ProductTable } from "@/components/product-table";
import { PushAllDraftsButton } from "@/components/push-all-drafts-button";
import { SyncStoreButton } from "@/components/sync-store-button";

// Real product list. Scoped to the active store.
// No store connected is handled by redirecting to /dashboard, since that's
// where the "Connect store" entry points live — this page doesn't
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

  const cookieStoreId = (await cookies()).get(ACTIVE_STORE_COOKIE_NAME)?.value ?? null;
  const currentStore = getActiveStoreForAccount(stores, cookieStoreId)!;
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
  const [paginatedResult, categories, productSummaries, aiRules] = await Promise.all([
    getPaginatedProductsForStore(account.id, currentStore.id, {
      page,
      pageSize,
      search,
      statusFilter,
      categoryFilter,
    }),
    getStoreCategories(account.id, currentStore.id),
    getProductSummariesForStore(account.id, currentStore.id),
    getAiRulesForStore(account.id, currentStore.id),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-3.5 sm:gap-4 p-3.5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Products</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {currentStore.name ?? currentStore.shopifyDomain ?? "Untitled Store"}
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0 sm:overflow-visible">
          <SyncStoreButton />
          <PushAllDraftsButton products={productSummaries} />
          <Button nativeButton={false} size="sm" render={<Link href="/products/new" />} className="text-xs sm:text-sm h-8 sm:h-9">
            <Plus className="size-3.5 sm:size-4" />
            <span className="hidden sm:inline">New product</span>
            <span className="sm:hidden">New</span>
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
          defaultPresentationStyle={aiRules.presentationStyle}
          defaultModelFaceNotes={aiRules.modelFaceDirective}
        />
      )}

    </div>
  );
}
