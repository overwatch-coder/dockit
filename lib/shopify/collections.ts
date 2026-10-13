import { toBareId } from "./products";
import { postShopifyGraphQL, type ShopifyRequestResult } from "./client";

const PAGE_SIZE = 100;

export type ShopifyCollection = {
  id: string;
  title: string;
};

type CollectionsFetchResult =
  | { success: true; data: ShopifyCollection[] }
  | { success: false; error: string };

type RawCollectionNode = { id: string; title: string };

type RawCollectionsPage = {
  edges: { node: RawCollectionNode }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

type RawCollectionsResponse = {
  data?: {
    collections?: RawCollectionsPage;
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

// The full list of a store's Shopify collections, for the product
// editor's manual Collection select — mirrors lib/shopify/products.ts's
// fetchAllProducts pagination shape exactly (same typed result, same
// cursor-loop). This is a plain read, called live on each product-editor page
// load rather than cached in Postgres.
export async function fetchAllCollections(
  shopDomain: string,
  accessToken: string
): Promise<CollectionsFetchResult> {
  const collections: ShopifyCollection[] = [];
  let after: string | null = null;

  try {
    do {
      const result: ShopifyRequestResult<RawCollectionsResponse> = await postShopifyGraphQL<RawCollectionsResponse>(
        shopDomain,
        accessToken,
        COLLECTIONS_QUERY,
        { first: PAGE_SIZE, after }
      );

      if (!result.ok) {
        return result.reason === "http-error"
          ? { success: false, error: `Collections fetch failed with status ${result.status}` }
          : { success: false, error: `Collections fetch request failed: ${result.message}` };
      }

      const page: RawCollectionsPage | undefined = result.body.data?.collections;
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
