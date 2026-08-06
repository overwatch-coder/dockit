import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { deleteProductFromShopify } from "@/lib/shopify/delete";

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("deleteProductFromShopify", () => {
  test("returns success when Shopify confirms the deletion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { productDelete: { deletedProductId: "gid://shopify/Product/1", userErrors: [] } },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteProductFromShopify("my-store.myshopify.com", "token", "1");

    expect(result).toEqual({ success: true });
  });

  test("treats an already-gone product (null deletedProductId, no userErrors) as success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { productDelete: { deletedProductId: null, userErrors: [] } } }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteProductFromShopify("my-store.myshopify.com", "token", "1");

    expect(result).toEqual({ success: true });
  });

  test("passes through a Shopify userError message, since those are written for display", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            productDelete: {
              deletedProductId: null,
              userErrors: [{ field: ["id"], message: "Product not found" }],
            },
          },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteProductFromShopify("my-store.myshopify.com", "token", "1");

    expect(result).toEqual({ success: false, error: "Product not found" });
  });

  test("sanitizes a raw top-level GraphQL error and logs the real one", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ errors: [{ message: "Variable $input of type ProductDeleteInput! was invalid" }] }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteProductFromShopify("my-store.myshopify.com", "token", "1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toContain("ProductDeleteInput");
    }
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("ProductDeleteInput"));
  });

  test("returns an error when the request itself fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteProductFromShopify("my-store.myshopify.com", "token", "1");

    expect(result).toEqual({ success: false, error: "Shopify request failed with status 500" });
  });
});
