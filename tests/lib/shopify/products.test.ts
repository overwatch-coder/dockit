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
  category: { id: string; fullName: string } | null;
  seo: { title: string | null; description: string | null };
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
    media: {
      nodes: (overrides.images ?? ["https://cdn.shopify.com/s/files/1/test.jpg"]).map((url) => ({
        image: { url },
      })),
    },
    collections: {
      edges:
        overrides.collection === null
          ? []
          : [{ node: overrides.collection ?? { id: "gid://shopify/Collection/5", title: "Shirts" } }],
    },
    category:
      overrides.category === null
        ? null
        : (overrides.category ?? {
            id: "gid://shopify/TaxonomyCategory/sg-4-17-2-17",
            fullName: "Apparel & Accessories > Clothing > Shirts & Tops",
          }),
    seo: overrides.seo ?? { title: "Test Product | Shop", description: "A great test product." },
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
          categoryId: "sg-4-17-2-17",
          categoryFullName: "Apparel & Accessories > Clothing > Shirts & Tops",
          seoTitle: "Test Product | Shop",
          seoDescription: "A great test product.",
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

  test("maps a product with no taxonomy category to null categoryId/categoryFullName", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      pageResponse([productNode({ category: null })], false, null)
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllProducts("my-store.myshopify.com", "shpat_test_token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].categoryId).toBeNull();
      expect(result.data[0].categoryFullName).toBeNull();
    }
  });

  test("maps a product with no SEO title/description to nulls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      pageResponse([productNode({ seo: { title: null, description: null } })], false, null)
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllProducts("my-store.myshopify.com", "shpat_test_token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].seoTitle).toBeNull();
      expect(result.data[0].seoDescription).toBeNull();
    }
  });

  test("returns a typed error with status on 401 revoked response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllProducts("my-store.myshopify.com", "bad-token");

    expect(result).toEqual({
      success: false,
      error: "Shopify authorization expired or revoked (HTTP 401). Please reconnect in Settings.",
      status: 401,
    });
  });

  test("returns a typed error with status on 404 not found response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllProducts("my-store.myshopify.com", "token");

    expect(result).toEqual({
      success: false,
      error: "Shopify store not found or deleted (HTTP 404). Check domain in Settings.",
      status: 404,
    });
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

  test("resolves taxonomy category from title when Shopify category is null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      pageResponse(
        [
          productNode({
            title: "The Collection Snowboard: Liquid",
            category: null,
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
      expect(result.data[0].categoryFullName).toContain("Snowboard");
      expect(result.data[0].categoryId).toBeTruthy();
    }
  });
});

describe("fetchProductsByIds", () => {
  test("fetches specific products by Shopify ID", async () => {
    const node = {
      id: "gid://shopify/Product/123",
      title: "Target Snowboard",
      descriptionHtml: "<p>Nice board</p>",
      status: "ACTIVE" as const,
      tags: ["winter"],
      featuredImage: { url: "https://cdn.shopify.com/image.jpg" },
      media: { nodes: [{ image: { url: "https://cdn.shopify.com/image.jpg" } }] },
      collections: { edges: [{ node: { id: "gid://shopify/Collection/1", title: "Boards" } }] },
      category: { id: "gid://shopify/TaxonomyCategory/sg-1", fullName: "Sporting Goods > Snowboards" },
      productType: "Snowboards",
      seo: { title: "Target", description: "Desc" },
      priceRangeV2: { minVariantPrice: { amount: "299.00" } },
      variants: {
        edges: [
          {
            node: {
              id: "gid://shopify/ProductVariant/456",
              title: "Default",
              price: "299.00",
              inventoryQuantity: 10,
            },
          },
        ],
      },
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            nodes: [node],
          },
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchProductsByIds } = await import("@/lib/shopify/products");
    const result = await fetchProductsByIds("my-store.myshopify.com", "token", ["123"]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBe(1);
      expect(result.data[0].shopifyProductId).toBe("123");
      expect(result.data[0].title).toBe("Target Snowboard");
    }
  });
});

describe("previewShopifyProducts", () => {
  test("returns preview items and pagination info", async () => {
    const previewNodes = [
      {
        id: "gid://shopify/Product/100",
        title: "Liquid Board",
        status: "ACTIVE" as const,
        featuredImage: { url: "https://cdn.shopify.com/thumb.jpg" },
        category: null,
        productType: "Snowboards",
        collections: { edges: [{ node: { id: "1", title: "Snow" } }] },
      },
    ];

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            products: {
              nodes: previewNodes,
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { previewShopifyProducts } = await import("@/lib/shopify/products");
    const result = await previewShopifyProducts("my-store.myshopify.com", "token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items.length).toBe(1);
      expect(result.data.items[0].shopifyProductId).toBe("100");
      expect(result.data.items[0].categoryFullName).toContain("Snowboard");
    }
  });
});

