import { toBareId } from "./products";
import { postShopifyGraphQL } from "./client";

export type ShopifyTaxonomyCategory = {
  id: string;
  name: string;
  // Shopify's own ready-made breadcrumb string (e.g. "Animals & Pet
  // Supplies > Pet Supplies > Dog Beds") — no manual breadcrumb
  // construction needed, verified live against shopify.dev before writing
  // this query (ai-workflow-rules.md #15).
  fullName: string;
};

type TaxonomySearchResult =
  | { success: true; data: ShopifyTaxonomyCategory[] }
  | { success: false; error: string };

type RawTaxonomyCategoryNode = { id: string; name: string; fullName: string; isLeaf: boolean };

type RawTaxonomyResponse = {
  data?: {
    taxonomy?: {
      categories?: {
        edges: { node: RawTaxonomyCategoryNode }[];
      };
    };
  };
};

const TAXONOMY_SEARCH_QUERY = `
  query SearchTaxonomyCategories($search: String!, $first: Int!) {
    taxonomy {
      categories(search: $search, first: $first) {
        edges {
          node {
            id
            name
            fullName
            isLeaf
          }
        }
      }
    }
  }
`;

// New standardized-taxonomy category search, distinct from
// lib/shopify/collections.ts's fetchAllCollections — Shopify's product
// taxonomy has ~10,000 categories, far too many to fetch wholesale like the
// small merchant-defined collections list, so this is a single bounded
// search page instead of a full cursor-paginated fetch. Mirrors
// collections.ts's request shape (same endpoint/headers) otherwise.
//
// Leaf-only, per a live bug report: a category picked from search results
// was saving locally and pushing with no Shopify error, but never actually
// showing up as the product's category in Shopify admin. Shopify's own
// taxonomy is hierarchical — "Apparel & Accessories" and "Clothing" are
// real, searchable nodes too, but they're broader groupings, not something
// a product is meant to be filed directly under (Shopify's help docs give
// examples like "Apparel & Accessories > Clothing > Clothing Tops > Shirts"
// — always the most specific node).
//
// Follow-up, per a live report that a plain, common leaf like "Shirts"
// (documented by Shopify itself as a real leaf under Clothing Tops) didn't
// show up searching "shirt": Shopify's own relevance ranking for a broad
// single-word search can bury a plain-named leaf well past the first ~30
// raw matches, so a light 3x over-fetch was still starving the leaf filter
// before it ever saw the result worth keeping. Widened substantially —
// over-fetches 10x the requested limit (capped at 200, Shopify's per-page
// max is 250) and returns up to 20 leaf matches by default (was 10) — a
// single extra GraphQL page cost, not a pagination loop, so still one
// request either way.
export async function searchTaxonomyCategories(
  shopDomain: string,
  accessToken: string,
  query: string,
  limit = 20
): Promise<TaxonomySearchResult> {
  try {
    const result = await postShopifyGraphQL<RawTaxonomyResponse>(
      shopDomain,
      accessToken,
      TAXONOMY_SEARCH_QUERY,
      { search: query, first: Math.min(limit * 10, 200) }
    );

    if (!result.ok) {
      return result.reason === "http-error"
        ? { success: false, error: `Taxonomy search failed with status ${result.status}` }
        : { success: false, error: `Taxonomy search request failed: ${result.message}` };
    }

    const edges = result.body.data?.taxonomy?.categories?.edges;
    if (!edges) {
      return { success: false, error: "Taxonomy search returned an unexpected response shape" };
    }

    return {
      success: true,
      data: edges
        .filter(({ node }) => node.isLeaf)
        .slice(0, limit)
        .map(({ node }) => ({ id: toBareId(node.id), name: node.name, fullName: node.fullName })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Taxonomy search request failed: ${message}` };
  }
}
