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
  test("renders 'Not pushed' when product has never been pushed to Shopify", () => {
    const product = makeProduct({ shopifyProductId: null });
    render(<ShopifyStatusBadge product={product} shopDomain="test-store.myshopify.com" />);

    expect(screen.getByText("Not pushed")).toBeInTheDocument();
    expect(screen.queryByTitle(/Open in Shopify Admin/i)).not.toBeInTheDocument();
  });

  test("renders 'Published' when product exists on Shopify and status is ACTIVE", () => {
    const product = makeProduct({
      shopifyProductId: "shopify-123",
      status: "ACTIVE",
    });
    render(<ShopifyStatusBadge product={product} shopDomain="test-store.myshopify.com" />);

    expect(screen.getByText("Published")).toBeInTheDocument();
    const link = screen.getByTitle(/Open in Shopify Admin/i);
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://test-store.myshopify.com/admin/products/shopify-123");
  });

  test("renders 'Unpublished' when product exists on Shopify and status is DRAFT", () => {
    const product = makeProduct({
      shopifyProductId: "shopify-456",
      status: "DRAFT",
    });
    render(<ShopifyStatusBadge product={product} shopDomain="test-store.myshopify.com" />);

    expect(screen.getByText("Unpublished")).toBeInTheDocument();
    const link = screen.getByTitle(/Open in Shopify Admin/i);
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://test-store.myshopify.com/admin/products/shopify-456");
  });

  test("does not render external link if shopDomain is null even if shopifyProductId exists", () => {
    const product = makeProduct({
      shopifyProductId: "shopify-789",
      status: "ACTIVE",
    });
    render(<ShopifyStatusBadge product={product} shopDomain={null} />);

    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.queryByTitle(/Open in Shopify Admin/i)).not.toBeInTheDocument();
  });
});
