import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShopifyStatusBadge } from "@/components/shopify-status-badge";
import type { Product } from "@/types/product";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    storeId: "store-1",
    shopifyProductId: null,
    title: "Test Product",
    description: "Description",
    imageUrl: null,
    imageUrls: [],
    price: "19.99",
    status: "DRAFT",
    tags: [],
    collectionId: null,
    collectionTitle: null,
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

describe("ShopifyStatusBadge", () => {
  test("renders 'Not published' when product has not been synced to Shopify", () => {
    const product = makeProduct({ shopifyProductId: null });
    render(<ShopifyStatusBadge product={product} shopDomain="test-store.myshopify.com" />);

    expect(screen.getByText("Not published")).toBeInTheDocument();
    expect(screen.queryByTitle(/Open in Shopify Admin/i)).not.toBeInTheDocument();
  });

  test("renders 'Published' when product exists on Shopify regardless of whether status is ACTIVE or DRAFT", () => {
    const activeProduct = makeProduct({
      shopifyProductId: "shopify-123",
      status: "ACTIVE",
    });
    const { rerender } = render(
      <ShopifyStatusBadge product={activeProduct} shopDomain="test-store.myshopify.com" />
    );

    expect(screen.getByText("Published")).toBeInTheDocument();
    const link = screen.getByTitle(/Open in Shopify Admin/i);
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://test-store.myshopify.com/admin/products/shopify-123");

    const draftProduct = makeProduct({
      shopifyProductId: "shopify-456",
      status: "DRAFT",
    });
    rerender(<ShopifyStatusBadge product={draftProduct} shopDomain="test-store.myshopify.com" />);

    expect(screen.getByText("Published")).toBeInTheDocument();
    const draftLink = screen.getByTitle(/Open in Shopify Admin/i);
    expect(draftLink).toHaveAttribute("href", "https://test-store.myshopify.com/admin/products/shopify-456");
  });

  test("does not render external link if shopDomain is null even if shopifyProductId exists", () => {
    const product = makeProduct({
      shopifyProductId: "shopify-789",
      status: "DRAFT",
    });
    render(<ShopifyStatusBadge product={product} shopDomain={null} />);

    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.queryByTitle(/Open in Shopify Admin/i)).not.toBeInTheDocument();
  });
});
