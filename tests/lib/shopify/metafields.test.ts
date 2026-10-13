import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchCategoryAttributes,
  fetchProductMetafieldDefinitions,
  fetchProductExistingMetafields,
} from "@/lib/shopify/metafields";

describe("lib/shopify/metafields", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchCategoryAttributes", () => {
    it("returns formatted category attributes from Shopify taxonomy", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        body: {
          data: {
            node: {
              attributes: {
                edges: [
                  {
                    node: {
                      __typename: "TaxonomyChoiceListAttribute",
                      id: "gid://shopify/TaxonomyAttribute/1",
                      name: "Color",
                      handle: "color",
                      values: {
                        edges: [
                          { node: { id: "gid://1", name: "Red" } },
                          { node: { id: "gid://2", name: "Blue" } },
                        ],
                      },
                    },
                  },
                  {
                    node: {
                      __typename: "TaxonomyAttribute",
                      id: "gid://shopify/TaxonomyAttribute/2",
                      name: "Material",
                      handle: "material",
                    },
                  },
                ],
              },
            },
          },
        },
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockResponse.body,
        })
      );

      const res = await fetchCategoryAttributes("test.myshopify.com", "token", "cat_123");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toHaveLength(2);
        expect(res.data[0]).toEqual({
          id: "gid://shopify/TaxonomyAttribute/1",
          name: "Color",
          handle: "color",
          type: "choice",
          choices: ["Red", "Blue"],
        });
        expect(res.data[1]).toEqual({
          id: "gid://shopify/TaxonomyAttribute/2",
          name: "Material",
          handle: "material",
          type: "text",
        });
      }
    });

    it("handles GraphQL failure cleanly", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({}),
        })
      );

      const res = await fetchCategoryAttributes("test.myshopify.com", "token", "cat_123");
      expect(res.success).toBe(false);
    });
  });

  describe("fetchProductMetafieldDefinitions", () => {
    it("returns store product metafield definitions", async () => {
      const mockResponse = {
        data: {
          metafieldDefinitions: {
            nodes: [
              {
                id: "gid://shopify/MetafieldDefinition/1",
                name: "Snowboard length",
                namespace: "test_data",
                key: "snowboard_length",
                description: "Length in cm",
                type: {
                  name: "dimension",
                  category: "MEASUREMENT",
                },
              },
            ],
          },
        },
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        })
      );

      const res = await fetchProductMetafieldDefinitions("test.myshopify.com", "token");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toHaveLength(1);
        expect(res.data[0]).toEqual({
          id: "gid://shopify/MetafieldDefinition/1",
          name: "Snowboard length",
          namespace: "test_data",
          key: "snowboard_length",
          description: "Length in cm",
          typeName: "dimension",
          category: "MEASUREMENT",
        });
      }
    });
  });

  describe("fetchProductExistingMetafields", () => {
    it("returns product metafield nodes", async () => {
      const mockResponse = {
        data: {
          product: {
            metafields: {
              nodes: [
                {
                  id: "gid://shopify/Metafield/10",
                  namespace: "test_data",
                  key: "binding_mount",
                  value: "4x4",
                  type: "single_line_text_field",
                },
              ],
            },
          },
        },
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        })
      );

      const res = await fetchProductExistingMetafields("test.myshopify.com", "token", "prod_1");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toHaveLength(1);
        expect(res.data[0].value).toBe("4x4");
      }
    });
  });
});
