import { postShopifyGraphQL } from "./client";

export type CategoryAttributeDefinition = {
  id: string; // e.g. "gid://shopify/TaxonomyAttribute/1"
  name: string; // e.g. "Color", "Snowboard construction"
  handle?: string;
  type: "choice" | "measurement" | "text";
  choices?: string[]; // Allowed values for choice attributes
  measurementOptions?: string[]; // e.g. ["cm", "in"]
};

export type ProductMetafieldDefinition = {
  id: string; // e.g. "gid://shopify/MetafieldDefinition/123"
  name: string; // e.g. "Snowboard binding mount"
  namespace: string; // e.g. "test_data" or "custom"
  key: string; // e.g. "binding_mount"
  description: string | null;
  typeName: string; // e.g. "single_line_text_field", "dimension"
  category: string | null; // e.g. "TEXT", "MEASUREMENT"
};

export type MetafieldValueEntry = {
  namespace: string;
  key: string;
  name: string;
  value: string;
  type?: string;
  isCategoryMetafield?: boolean;
};

type CategoryAttributesResponse = {
  data?: {
    node?: {
      attributes?: {
        edges: {
          node: {
            __typename: string;
            id: string;
            name?: string;
            handle?: string;
            values?: {
              edges: {
                node: {
                  id: string;
                  name: string;
                };
              }[];
            };
            options?: string[];
          };
        }[];
      };
    };
  };
};

const CATEGORY_ATTRIBUTES_QUERY = `
  query GetCategoryAttributes($id: ID!) {
    node(id: $id) {
      ... on TaxonomyCategory {
        id
        name
        fullName
        attributes(first: 50) {
          edges {
            node {
              __typename
              id
              name
              handle
              ... on TaxonomyChoiceListAttribute {
                values(first: 50) {
                  edges {
                    node {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function fetchCategoryAttributes(
  shopDomain: string,
  accessToken: string,
  categoryId: string
): Promise<{ success: true; data: CategoryAttributeDefinition[] } | { success: false; error: string }> {
  try {
    const gid = categoryId.startsWith("gid://")
      ? categoryId
      : `gid://shopify/TaxonomyCategory/${categoryId}`;

    const res = await postShopifyGraphQL<CategoryAttributesResponse>(
      shopDomain,
      accessToken,
      CATEGORY_ATTRIBUTES_QUERY,
      { id: gid }
    );

    if (!res.ok) {
      return { success: false, error: res.reason === "http-error" ? `HTTP error ${res.status}` : res.message };
    }

    const edges = res.body.data?.node?.attributes?.edges ?? [];
    const definitions: CategoryAttributeDefinition[] = edges.map(({ node }) => {
      const type = node.__typename === "TaxonomyChoiceListAttribute"
        ? "choice"
        : node.__typename === "TaxonomyMeasurementAttribute"
        ? "measurement"
        : "text";

      const choices = node.values?.edges.map((e) => e.node.name) ?? [];
      const measurementOptions = node.options ?? [];

      return {
        id: node.id,
        name: node.name || "Attribute",
        handle: node.handle || (node.name ? node.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "attr"),
        type,
        ...(choices.length > 0 ? { choices } : {}),
        ...(measurementOptions.length > 0 ? { measurementOptions } : {}),
      };
    });

    return { success: true, data: definitions };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to fetch category attributes" };
  }
}

type ProductMetafieldDefsResponse = {
  data?: {
    metafieldDefinitions?: {
      nodes: {
        id: string;
        name: string;
        namespace: string;
        key: string;
        description: string | null;
        type: {
          name: string;
          category: string | null;
        };
      }[];
    };
  };
};

const PRODUCT_METAFIELD_DEFS_QUERY = `
  query GetProductMetafieldDefs {
    metafieldDefinitions(first: 50, ownerType: PRODUCT) {
      nodes {
        id
        name
        namespace
        key
        description
        type {
          name
          category
        }
      }
    }
  }
`;

export async function fetchProductMetafieldDefinitions(
  shopDomain: string,
  accessToken: string
): Promise<{ success: true; data: ProductMetafieldDefinition[] } | { success: false; error: string }> {
  try {
    const res = await postShopifyGraphQL<ProductMetafieldDefsResponse>(
      shopDomain,
      accessToken,
      PRODUCT_METAFIELD_DEFS_QUERY,
      {}
    );

    if (!res.ok) {
      return { success: false, error: res.reason === "http-error" ? `HTTP error ${res.status}` : res.message };
    }

    const nodes = res.body.data?.metafieldDefinitions?.nodes ?? [];
    const defs: ProductMetafieldDefinition[] = nodes.map((node) => ({
      id: node.id,
      name: node.name,
      namespace: node.namespace,
      key: node.key,
      description: node.description,
      typeName: node.type.name,
      category: node.type.category,
    }));

    return { success: true, data: defs };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to fetch product metafield definitions" };
  }
}

type ProductExistingMetafieldsResponse = {
  data?: {
    product?: {
      metafields?: {
        nodes: {
          id: string;
          namespace: string;
          key: string;
          value: string;
          type: string;
        }[];
      };
    };
  };
};

const PRODUCT_METAFIELDS_QUERY = `
  query GetProductMetafields($id: ID!) {
    product(id: $id) {
      metafields(first: 50) {
        nodes {
          id
          namespace
          key
          value
          type
        }
      }
    }
  }
`;

export async function fetchProductExistingMetafields(
  shopDomain: string,
  accessToken: string,
  productGid: string
): Promise<{ success: true; data: { id: string; namespace: string; key: string; value: string; type: string }[] } | { success: false; error: string }> {
  try {
    const gid = productGid.startsWith("gid://") ? productGid : `gid://shopify/Product/${productGid}`;
    const res = await postShopifyGraphQL<ProductExistingMetafieldsResponse>(
      shopDomain,
      accessToken,
      PRODUCT_METAFIELDS_QUERY,
      { id: gid }
    );

    if (!res.ok) {
      return { success: false, error: res.reason === "http-error" ? `HTTP error ${res.status}` : res.message };
    }

    return { success: true, data: res.body.data?.product?.metafields?.nodes ?? [] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to fetch product metafields" };
  }
}
