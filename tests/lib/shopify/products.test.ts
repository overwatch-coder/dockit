import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchAllProducts } from "@/lib/shopify/products";

afterEach(() => {
  vi.unstubAllGlobals();
});

function productNode(overrides: Partial<{
  id: string;
  title: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  tags: string[];
  price: string;
  imageUrl: string | null;
  images: string[];
  collection: { id: string; title: string } | null;
}> = {}) {
  return {
    id: overrides.id ?? "gid://shopify/Product/1",
    title: overrides.title ?? "Test Product",
    descriptionHtml: "<p>Desc</p>",
    status: overrides.status ?? "ACTIVE",
    tags: overrides.tags ?? ["tag1"],
    featuredImage:
      overrides.imageUrl === null
        ? null
        : { url: overrides.imageUrl ?? "https://cdn.shopify.com/s/files/1/test.jpg" },
    images: {
      edges: (overrides.images ?? ["https://cdn.shopify.com/s/files/1/test.jpg"]).map((url) => ({
        node: { url },
      })),
    },
    collections: {
      edges:
        overrides.collection === null
          ? []
          : [{ node: overrides.collection ?? { id: "gid://shopify/Collection/5", title: "Shirts" } }],
    },
    priceRangeV2: { minVariantPrice: { amount: overrides.price ?? "19.99" } },
    variants: {
      edges: [
        {
          node: {
            id: "gid://shopify/ProductVariant/10",
            title: "Default Title",
            price: overrides.price ?? "19.99",
            inventoryQuantity: 5,
          },
        },
      ],
    },
  };
}

function pageResponse(nodes: ReturnType<typeof productNode>[], hasNextPage: boolean, endCursor: string | null) {
  return new Response(
    JSON.stringify({
      data: {
        products: {
          edges: nodes.map((node) => ({ node })),
          pageInfo: { hasNextPage, endCursor },
        },
      },
    }),
    { status: 200 }
  );
}

describe("fetchAllProducts", () => {
  test("maps a single page of products into the imported shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(pageResponse([productNode()], false, null));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllProducts("my-store.myshopify.com", "shpat_test_token");

    expect(result).toEqual({
      success: true,
      data: [
        {
          shopifyProductId: "1",
          title: "Test Product",
          description: "<p>Desc</p>",
          imageUrl: "https://cdn.shopify.com/s/files/1/test.jpg",
          imageUrls: ["https://cdn.shopify.com/s/files/1/test.jpg"],
          price: "19.99",
          status: "ACTIVE",
          tags: ["tag1"],
          collectionId: "5",
          collectionTitle: "Shirts",
          variants: [
            { shopifyVariantId: "10", optionName: "Default Title", price: "19.99", inventory: 5 },
          ],
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("follows cursor pagination across multiple pages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        pageResponse([productNode({ id: "gid://shopify/Product/1" })], true, "cursor-1")
      )
      .mockResolvedValueOnce(
        pageResponse([productNode({ id: "gid://shopify/Product/2" })], false, null)
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllProducts("my-store.myshopify.com", "shpat_test_token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((product) => product.shopifyProductId)).toEqual(["1", "2"]);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondCallBody.variables.after).toBe("cursor-1");
  });

  test("maps DRAFT and ARCHIVED statuses down to the schema's DRAFT value", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      pageResponse(
        [
          productNode({ id: "gid://shopify/Product/1", status: "DRAFT" }),
          productNode({ id: "gid://shopify/Product/2", status: "ARCHIVED" }),
        ],
        false,
        null
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllProducts("my-store.myshopify.com", "shpat_test_token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((product) => product.status)).toEqual(["DRAFT", "DRAFT"]);
    }
  });

  test("maps a missing featuredImage to a null imageUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue(pageResponse([productNode({ imageUrl: null })], false, null));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllProducts("my-store.myshopify.com", "shpat_test_token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].imageUrl).toBeNull();
    }
  });

  test("maps multiple product images into imageUrls, in order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      pageResponse(
        [
          productNode({
            images: [
              "https://cdn.shopify.com/s/files/1/a.jpg",
              "https://cdn.shopify.com/s/files/1/b.jpg",
              "https://cdn.shopify.com/s/files/1/c.jpg",
            ],
          }),
        ],
        false,
        null
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllProducts("my-store.myshopify.com", "shpat_test_token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].imageUrls).toEqual([
        "https://cdn.shopify.com/s/files/1/a.jpg",
        "https://cdn.shopify.com/s/files/1/b.jpg",
        "https://cdn.shopify.com/s/files/1/c.jpg",
      ]);
    }
  });

  test("maps a product with no images to an empty imageUrls array", async () => {
    const fetchMock = vi.fn().mockResolvedValue(pageResponse([productNode({ images: [] })], false, null));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllProducts("my-store.myshopify.com", "shpat_test_token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].imageUrls).toEqual([]);
    }
  });

  test("maps a product with no collection to null collectionId/collectionTitle", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      pageResponse([productNode({ collection: null })], false, null)
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllProducts("my-store.myshopify.com", "shpat_test_token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].collectionId).toBeNull();
      expect(result.data[0].collectionTitle).toBeNull();
    }
  });

  test("returns a typed error on a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllProducts("my-store.myshopify.com", "bad-token");

    expect(result).toEqual({ success: false, error: "Product import fetch failed with status 401" });
  });

  test("returns a typed error on a network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllProducts("my-store.myshopify.com", "shpat_test_token");

    expect(result).toEqual({
      success: false,
      error: "Product import request failed: network down",
    });
  });
});
