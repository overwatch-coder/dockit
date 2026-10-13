import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductTable } from "@/components/product-table";
import type { Product } from "@/types/product";
import type { PaginatedProductsResult, ProductSummary } from "@/lib/db/products";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/products",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/hooks/use-job-polling", () => ({
  useJobPolling: () => ({
    isPolling: false,
    start: vi.fn(),
  }),
}));

vi.mock("@/app/(dashboard)/products/actions", () => ({
  generateBulkAiVisionEnrichmentAction: vi.fn().mockResolvedValue({ success: true, enrichedCount: 2 }),
  pushSelectedProducts: vi.fn(),
  duplicateProduct: vi.fn(),
  generateBulkProductSeoSuggestions: vi.fn(),
  startBulkProductImageGenerationAction: vi.fn(),
  applyBulkAiSuggestions: vi.fn(),
}));

function createMockProduct(id: string, title: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    storeId: "store-1",
    shopifyProductId: null,
    title,
    description: "Sample product description",
    imageUrl: null,
    imageUrls: [],
    price: "49.00",
    status: "DRAFT",
    tags: ["apparel"],
    collectionId: null,
    collectionTitle: "Apparel",
    categoryId: null,
    categoryFullName: null,
    seoTitle: null,
    seoDescription: null,
    isConflicted: false,
    conflictAppSnapshot: null,
    conflictShopifySnapshot: null,
    variants: [],
    lastSyncedAt: null,
    ...overrides,
  };
}

describe("ProductTable", () => {
  const product1 = createMockProduct("prod-1", "Organic Cotton Hoodie", {
    shopifyProductId: "shopify-101",
    status: "ACTIVE",
  });
  const product2 = createMockProduct("prod-2", "Recycled Canvas Cap", {
    shopifyProductId: null,
    status: "DRAFT",
  });

  const paginatedResult: PaginatedProductsResult = {
    products: [product1, product2],
    totalCount: 2,
    totalPages: 1,
    page: 1,
    pageSize: 25,
  };

  const allSummaries: ProductSummary[] = [
    { id: product1.id, title: product1.title, shopifyProductId: product1.shopifyProductId, isConflicted: false },
    { id: product2.id, title: product2.title, shopifyProductId: product2.shopifyProductId, isConflicted: false },
  ];

  it("renders the Shopify column in the table header and rows", () => {
    render(
      <ProductTable
        paginatedResult={paginatedResult}
        categories={["Apparel"]}
        shopDomain="test-store.myshopify.com"
        allProducts={allSummaries}
      />
    );

    // Header column
    expect(screen.getByRole("columnheader", { name: "Shopify" })).toBeInTheDocument();

    // Row status values in the Shopify column
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Not pushed")).toBeInTheDocument();
  });

  it("shows 'Generate Image with Content' and 'Generate Content' when items are selected", async () => {
    render(
      <ProductTable
        paginatedResult={paginatedResult}
        categories={["Apparel"]}
        shopDomain="test-store.myshopify.com"
        allProducts={allSummaries}
      />
    );

    // Select all products via the master checkbox
    const selectAllCheckbox = screen.getByRole("checkbox", { name: /select all products/i });
    fireEvent.click(selectAllCheckbox);

    // Expect the selection action bar to show the new buttons
    expect(screen.getByRole("button", { name: /generate image with content/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate content/i })).toBeInTheDocument();

    // Old buttons must NOT be present
    expect(screen.queryByRole("button", { name: /^generate images$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^generate ai suggestions$/i })).not.toBeInTheDocument();

    // Standard actions are still present
    expect(screen.getByRole("button", { name: /push selected/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change status/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
  });
});
