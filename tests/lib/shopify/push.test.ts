import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { pushProductToShopify, type PushProductInput } from "@/lib/shopify/push";

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function baseInput(overrides: Partial<PushProductInput> = {}): PushProductInput {
  return {
    shopifyProductId: null,
    title: "Test Product",
    descriptionHtml: "<p>Desc</p>",
    status: "DRAFT",
    tags: [],
    seoTitle: null,
    seoDescription: null,
    price: "19.99",
    collectionId: null,
    categoryId: null,
    imageUrls: [],
    variants: [],
    ...overrides,
  };
}

function productSetResponse(variantNodes: { id: string; title: string }[] = []) {
  return new Response(
    JSON.stringify({
      data: {
        productSet: {
          product: { id: "gid://shopify/Product/1", variants: { nodes: variantNodes } },
          userErrors: [],
        },
      },
    }),
    { status: 200 }
  );
}

function lastRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return JSON.parse(call[1].body as string);
}

describe("pushProductToShopify — variant/option payload shape", () => {
  test("sends a synthetic Default Title variant with productOptions when there are no local variants", async () => {
    const fetchMock = vi.fn().mockResolvedValue(productSetResponse());
    vi.stubGlobal("fetch", fetchMock);

    await pushProductToShopify("my-store.myshopify.com", "token", baseInput({ variants: [] }));

    const body = lastRequestBody(fetchMock);
    expect(body.variables.input.productOptions).toEqual([
      { name: "Title", position: 1, values: [{ name: "Default Title" }] },
    ]);
    expect(body.variables.input.variants).toEqual([
      { price: "19.99", optionValues: [{ optionName: "Title", name: "Default Title" }] },
    ]);
  });

  test("always sends productOptions/optionValues consistently when local variants exist", async () => {
    const fetchMock = vi.fn().mockResolvedValue(productSetResponse());
    vi.stubGlobal("fetch", fetchMock);

    await pushProductToShopify(
      "my-store.myshopify.com",
      "token",
      baseInput({
        variants: [
          { id: "v1", shopifyVariantId: null, optionName: "Small", price: "10.00", inventory: 3 },
          { id: "v2", shopifyVariantId: "99", optionName: "Large", price: "12.00", inventory: 4 },
        ],
      })
    );

    const body = lastRequestBody(fetchMock);
    expect(body.variables.input.productOptions).toEqual([
      { name: "Title", position: 1, values: [{ name: "Small" }, { name: "Large" }] },
    ]);
    expect(body.variables.input.variants).toEqual([
      { price: "10.00", optionValues: [{ optionName: "Title", name: "Small" }] },
      {
        id: "gid://shopify/ProductVariant/99",
        price: "12.00",
        optionValues: [{ optionName: "Title", name: "Large" }],
      },
    ]);
  });

  test("defaults a blank variant name to Default Title", async () => {
    const fetchMock = vi.fn().mockResolvedValue(productSetResponse());
    vi.stubGlobal("fetch", fetchMock);

    await pushProductToShopify(
      "my-store.myshopify.com",
      "token",
      baseInput({
        variants: [{ id: "v1", shopifyVariantId: null, optionName: "   ", price: "10.00", inventory: 1 }],
      })
    );

    const body = lastRequestBody(fetchMock);
    expect(body.variables.input.variants[0].optionValues).toEqual([
      { optionName: "Title", name: "Default Title" },
    ]);
  });

  test("disambiguates duplicate variant names instead of sending Shopify colliding option values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(productSetResponse());
    vi.stubGlobal("fetch", fetchMock);

    await pushProductToShopify(
      "my-store.myshopify.com",
      "token",
      baseInput({
        variants: [
          { id: "v1", shopifyVariantId: null, optionName: "Small", price: "10.00", inventory: 1 },
          { id: "v2", shopifyVariantId: null, optionName: "Small", price: "11.00", inventory: 1 },
        ],
      })
    );

    const body = lastRequestBody(fetchMock);
    const names = body.variables.input.variants.map(
      (v: { optionValues: { name: string }[] }) => v.optionValues[0].name
    );
    expect(names).toEqual(["Small", "Small (2)"]);
    expect(new Set(names).size).toBe(2);
  });
});

describe("pushProductToShopify — error sanitization", () => {
  test("replaces a raw top-level GraphQL error with a friendly message and logs the real one", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [
            {
              message:
                "Variable $input of type ProductSetInput! was provided invalid value for variants.0.optionValues (Expected value to not be null)",
            },
          ],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await pushProductToShopify("my-store.myshopify.com", "token", baseInput());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toContain("ProductSetInput");
      expect(result.error).not.toContain("$input");
      expect(result.error.length).toBeGreaterThan(0);
    }
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("ProductSetInput"));
  });

  test("leaves a Shopify userError message untouched, since those are written for display", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            productSet: {
              product: null,
              userErrors: [{ field: ["price"], message: "Price must be greater than 0.00", code: "INVALID" }],
            },
          },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await pushProductToShopify("my-store.myshopify.com", "token", baseInput());

    expect(result).toEqual({ success: false, error: "Price must be greater than 0.00" });
  });
});
