const ADMIN_API_VERSION = "2026-07";
const PAGE_SIZE = 50;

export type ShopifyImportedVariant = {
  shopifyVariantId: string;
  optionName: string;
  price: string;
  inventory: number;
};

export type ShopifyImportedProduct = {
  shopifyProductId: string;
  title: string;
  description: string | null;
  price: string;
  status: "ACTIVE" | "DRAFT";
  tags: string[];
  variants: ShopifyImportedVariant[];
};

type ProductsFetchResult =
  | { success: true; data: ShopifyImportedProduct[] }
  | { success: false; error: string };

type RawVariantNode = {
  id: string;
  title: string;
  price: string;
  inventoryQuantity: number | null;
};

type RawProductNode = {
  id: string;
  title: string;
  descriptionHtml: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  tags: string[];
  priceRangeV2: { minVariantPrice: { amount: string } };
  variants: { edges: { node: RawVariantNode }[] };
};

type RawProductsResponse = {
  data?: {
    products?: {
      edges: { node: RawProductNode }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
};

// Strips a Shopify GID ("gid://shopify/Product/123") down to the bare
// numeric id, which is what gets stored on Product.shopifyProductId.
function toBareId(gid: string): string {
  return gid.split("/").pop() ?? gid;
}

// Schema's ProductStatus enum only has DRAFT | ACTIVE (context/00-build-plan.md
// Unit 2), so Shopify's ARCHIVED collapses into DRAFT — a deliberate
// simplification, not an oversight.
function toProductStatus(status: RawProductNode["status"]): "ACTIVE" | "DRAFT" {
  return status === "ACTIVE" ? "ACTIVE" : "DRAFT";
}

function toImportedProduct(node: RawProductNode): ShopifyImportedProduct {
  return {
    shopifyProductId: toBareId(node.id),
    title: node.title,
    description: node.descriptionHtml || null,
    price: node.priceRangeV2.minVariantPrice.amount,
    status: toProductStatus(node.status),
    tags: node.tags,
    variants: node.variants.edges.map(({ node: variant }) => ({
      shopifyVariantId: toBareId(variant.id),
      optionName: variant.title,
      price: variant.price,
      inventory: variant.inventoryQuantity ?? 0,
    })),
  };
}

const PRODUCTS_QUERY = `
  query ImportProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          title
          descriptionHtml
          status
          tags
          priceRangeV2 {
            minVariantPrice {
              amount
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
                inventoryQuantity
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Pulls every product from a store's catalog, following Shopify's cursor
// pagination until exhausted. v1 scope: one accumulated array, no chunked
// job steps — matches Unit 6's "just the plumbing" simplicity; large-catalog
// handling isn't asked for by context/00-build-plan.md Unit 7.
export async function fetchAllProducts(
  shopDomain: string,
  accessToken: string
): Promise<ProductsFetchResult> {
  const products: ShopifyImportedProduct[] = [];
  let after: string | null = null;

  try {
    do {
      const response = await fetch(`https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: PRODUCTS_QUERY,
          variables: { first: PAGE_SIZE, after },
        }),
      });

      if (!response.ok) {
        return { success: false, error: `Product import fetch failed with status ${response.status}` };
      }

      const body = (await response.json()) as RawProductsResponse;
      const page = body.data?.products;
      if (!page) {
        return { success: false, error: "Product import fetch returned an unexpected response shape" };
      }

      products.push(...page.edges.map(({ node }) => toImportedProduct(node)));
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after !== null);

    return { success: true, data: products };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Product import request failed: ${message}` };
  }
}
