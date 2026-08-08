import { toBareId } from "./products";

const ADMIN_API_VERSION = "2026-07";

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
// — always the most specific node). Only a leaf node (no children) is the
// "actual" category a product can be usefully assigned to; over-fetches by
// 3x and filters to isLeaf so a broad/ambiguous search term still returns a
// full page of genuinely assignable results instead of getting starved by
// filtering after the fact.
export async function searchTaxonomyCategories(
  shopDomain: string,
  accessToken: string,
  query: string,
  limit = 10
): Promise<TaxonomySearchResult> {
  try {
    const response = await fetch(`https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: TAXONOMY_SEARCH_QUERY,
        variables: { search: query, first: limit * 3 },
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Taxonomy search failed with status ${response.status}` };
    }

    const body = (await response.json()) as RawTaxonomyResponse;
    const edges = body.data?.taxonomy?.categories?.edges;
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
