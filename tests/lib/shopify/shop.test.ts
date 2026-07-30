import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchShopName } from "@/lib/shopify/shop";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchShopName", () => {
  test("returns the shop name on a successful response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { shop: { name: "My Shopify Store" } } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchShopName("my-store.myshopify.com", "shpat_test_token");

    expect(result).toEqual({ success: true, data: { name: "My Shopify Store" } });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://my-store.myshopify.com/admin/api/2026-07/graphql.json",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Shopify-Access-Token": "shpat_test_token" }),
      })
    );
  });

  test("returns a typed error on a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchShopName("my-store.myshopify.com", "bad-token");

    expect(result).toEqual({ success: false, error: "Shop name lookup failed with status 401" });
  });

  test("returns a typed error on a network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchShopName("my-store.myshopify.com", "shpat_test_token");

    expect(result).toEqual({
      success: false,
      error: "Shop name lookup request failed: network down",
    });
  });
});
