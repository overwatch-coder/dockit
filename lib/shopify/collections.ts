import { toBareId } from "./products";

const ADMIN_API_VERSION = "2026-07";
const PAGE_SIZE = 100;

export type ShopifyCollection = {
  id: string;
  title: string;
};

type CollectionsFetchResult =
  | { success: true; data: ShopifyCollection[] }
  | { success: false; error: string };

type RawCollectionNode = { id: string; title: string };

type RawCollectionsResponse = {
  data?: {
    collections?: {
      edges: { node: RawCollectionNode }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
};

const COLLECTIONS_QUERY = `
  query FetchCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      edges {
        node {
          id
          title
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Unit 13: the full list of a store's Shopify collections, for the product
// editor's manual Collection select — mirrors lib/shopify/products.ts's
// fetchAllProducts pagination shape exactly (same typed result, same
// cursor-loop). This is a plain read, called live on each product-editor page
// load rather than cached in Postgres, per this unit's own scope decision.
export async function fetchAllCollections(
  shopDomain: string,
  accessToken: string
): Promise<CollectionsFetchResult> {
  const collections: ShopifyCollection[] = [];
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
          query: COLLECTIONS_QUERY,
          variables: { first: PAGE_SIZE, after },
        }),
      });

      if (!response.ok) {
        return { success: false, error: `Collections fetch failed with status ${response.status}` };
      }

      const body = (await response.json()) as RawCollectionsResponse;
      const page = body.data?.collections;
      if (!page) {
        return { success: false, error: "Collections fetch returned an unexpected response shape" };
      }

      collections.push(
        ...page.edges.map(({ node }) => ({ id: toBareId(node.id), title: node.title }))
      );
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after !== null);

    return { success: true, data: collections };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Collections fetch request failed: ${message}` };
  }
}
