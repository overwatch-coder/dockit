import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchAllCollections } from "@/lib/shopify/collections";

afterEach(() => {
  vi.unstubAllGlobals();
});

function collectionNode(overrides: Partial<{ id: string; title: string }> = {}) {
  return {
    id: overrides.id ?? "gid://shopify/Collection/1",
    title: overrides.title ?? "Test Collection",
  };
}

function pageResponse(
  nodes: ReturnType<typeof collectionNode>[],
  hasNextPage: boolean,
  endCursor: string | null
) {
  return new Response(
    JSON.stringify({
      data: {
        collections: {
          edges: nodes.map((node) => ({ node })),
          pageInfo: { hasNextPage, endCursor },
        },
      },
    }),
    { status: 200 }
  );
}

describe("fetchAllCollections", () => {
  test("maps a single page of collections, stripping the GID down to a bare id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(pageResponse([collectionNode()], false, null));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllCollections("my-store.myshopify.com", "shpat_test_token");

    expect(result).toEqual({
      success: true,
      data: [{ id: "1", title: "Test Collection" }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("follows cursor pagination across multiple pages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        pageResponse([collectionNode({ id: "gid://shopify/Collection/1" })], true, "cursor-1")
      )
      .mockResolvedValueOnce(
        pageResponse([collectionNode({ id: "gid://shopify/Collection/2" })], false, null)
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllCollections("my-store.myshopify.com", "shpat_test_token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((collection) => collection.id)).toEqual(["1", "2"]);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondCallBody.variables.after).toBe("cursor-1");
  });

  test("returns a typed error on a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllCollections("my-store.myshopify.com", "bad-token");

    expect(result).toEqual({ success: false, error: "Collections fetch failed with status 401" });
  });

  test("returns a typed error on a network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAllCollections("my-store.myshopify.com", "shpat_test_token");

    expect(result).toEqual({
      success: false,
      error: "Collections fetch request failed: network down",
    });
  });
});
