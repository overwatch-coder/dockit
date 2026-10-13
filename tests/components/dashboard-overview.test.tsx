import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardOverview } from "@/components/dashboard-overview";
import type { Store } from "@/types/store";
import type { Product } from "@/types/product";

// Mock SyncStoreButton since it depends on Inngest/job polling hooks
vi.mock("@/components/sync-store-button", () => ({
  SyncStoreButton: () => <button data-testid="sync-store-button">Sync store</button>,
}));

const mockStore: Store = {
  id: "store-123",
  shopifyDomain: "snow-peak.myshopify.com",
  name: "Snow Peak Outdoors",
  connectedAt: new Date("2026-08-01T12:00:00Z"),
};

function createMockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    storeId: "store-123",
    shopifyProductId: "sh-1",
    title: "All-Mountain Snowboard",
    description: "High performance snowboard",
    imageUrl: "https://cdn.shopify.com/snowboard.jpg",
    imageUrls: ["https://cdn.shopify.com/snowboard.jpg"],
    price: "499.00",
    status: "ACTIVE",
    tags: ["snowboard", "winter"],
    collectionId: "col-1",
    collectionTitle: "Winter Collection",
    categoryId: "cat-1",
    categoryFullName: "Sporting Goods > Winter Sports > Snowboards",
    seoTitle: null,
    seoDescription: null,
    isConflicted: false,
    conflictAppSnapshot: null,
    conflictShopifySnapshot: null,
    variants: [
      {
        id: "var-1",
        shopifyVariantId: "shvar-1",
        optionName: "156cm",
        price: "499.00",
        inventory: 10,
        imageUrl: null,
      },
    ],
    lastSyncedAt: new Date("2026-10-13T10:00:00Z"),
    lastEditedAt: new Date("2026-10-13T10:00:00Z"),
    createdAt: new Date("2026-10-01T10:00:00Z"),
    ...overrides,
  };
}

describe("DashboardOverview component", () => {
  it("renders the store name, domain, and overview header", () => {
    render(<DashboardOverview store={mockStore} products={[]} />);

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getAllByText("Snow Peak Outdoors").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("sync-store-button")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View products" })).toHaveAttribute("href", "/products");
  });

  it("renders metric cards accurately for products", () => {
    const products: Product[] = [
      createMockProduct({ id: "p1", status: "ACTIVE", isConflicted: false }),
      createMockProduct({ id: "p2", status: "DRAFT", isConflicted: false }),
      createMockProduct({ id: "p3", status: "ACTIVE", isConflicted: true }),
    ];

    render(<DashboardOverview store={mockStore} products={products} />);

    expect(screen.getByText("Total Products")).toBeInTheDocument();
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Active/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Draft/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Conflict/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the analytics chart cards and timeframe toggle", () => {
    const products: Product[] = [
      createMockProduct({ id: "p1" }),
      createMockProduct({ id: "p2", categoryFullName: "Sporting Goods > Ski Wax" }),
    ];

    render(<DashboardOverview store={mockStore} products={products} />);

    expect(screen.getByText("Catalog Activity")).toBeInTheDocument();
    expect(screen.getByText("Status Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Top Categories")).toBeInTheDocument();

    const button7d = screen.getByRole("button", { name: "7d" });
    const button30d = screen.getByRole("button", { name: "30d" });

    expect(button7d).toBeInTheDocument();
    expect(button30d).toBeInTheDocument();

    fireEvent.click(button7d);
    expect(button7d).toBeInTheDocument();
  });

  it("renders store connection details and domain links", () => {
    render(<DashboardOverview store={mockStore} products={[]} />);

    expect(screen.getByText("Store Connection")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("snow-peak.myshopify.com")).toBeInTheDocument();
  });

  it("renders clean disconnected state when store is not connected", () => {
    const disconnectedStore: Store = {
      ...mockStore,
      connectedAt: null,
      shopifyDomain: null,
    };

    render(<DashboardOverview store={disconnectedStore} products={[]} />);

    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByText("Connect Shopify Account in Settings →")).toBeInTheDocument();
  });
});
