import { postShopifyGraphQL, type ShopifyRequestResult } from "./client";

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
  imageUrl: string | null;
  imageUrls: string[];
  price: string;
  status: "ACTIVE" | "DRAFT";
  tags: string[];
  collectionId: string | null;
  collectionTitle: string | null;
  categoryId: string | null;
  categoryFullName: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
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
  featuredImage: { url: string } | null;
  // Unit 25: fetched via `media` rather than the deprecated `images` field
  // (confirmed deprecated on shopify.dev during this unit) — the switch
  // isn't cosmetic: lib/shopify/push.ts looks up a variant's linked image by
  // matching its stored URL against `media`'s own image.url at push time,
  // so an imported/synced imageUrls entry has to be sourced from that same
  // `media` field to be guaranteed an exact string match, not just a
  // probably-identical one from a different field.
  media: { nodes: { image?: { url: string } | null }[] };
  // Only the first collection is fetched — a product's full collection
  // membership and the ability to assign/change it is Unit 13's job; this is
  // a read-only "primary collection" display for the product list's Category
  // column.
  collections: { edges: { node: { id: string; title: string } }[] };
  // Shopify's separate standardized Product Taxonomy category, distinct
  // from collections above — null when the product has never had one set.
  category: { id: string; fullName: string } | null;
  seo: { title: string | null; description: string | null };
  priceRangeV2: { minVariantPrice: { amount: string } };
  variants: { edges: { node: RawVariantNode }[] };
};

type RawProductsPage = {
  edges: { node: RawProductNode }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

type RawProductsResponse = {
  data?: {
    products?: RawProductsPage;
  };
};

// Strips a Shopify GID ("gid://shopify/Product/123") down to the bare
// numeric id, which is what gets stored on Product.shopifyProductId (and,
// via lib/shopify/collections.ts, Product.collectionId).
export function toBareId(gid: string): string {
  return gid.split("/").pop() ?? gid;
}

// Schema's ProductStatus enum only has DRAFT | ACTIVE (context/00-build-plan.md
// Unit 2), so Shopify's ARCHIVED collapses into DRAFT — a deliberate
// simplification, not an oversight.
function toProductStatus(status: RawProductNode["status"]): "ACTIVE" | "DRAFT" {
  return status === "ACTIVE" ? "ACTIVE" : "DRAFT";
}

function toImportedProduct(node: RawProductNode): ShopifyImportedProduct {
  const primaryCollection = node.collections.edges[0]?.node ?? null;
  return {
    shopifyProductId: toBareId(node.id),
    title: node.title,
    description: node.descriptionHtml || null,
    imageUrl: node.featuredImage?.url ?? null,
    // Non-image media (video, 3D model) has no `image` field — filtered out
    // rather than producing a hole in the gallery array.
    imageUrls: node.media.nodes.map((media) => media.image?.url).filter((url): url is string => Boolean(url)),
    price: node.priceRangeV2.minVariantPrice.amount,
    status: toProductStatus(node.status),
    tags: node.tags,
    collectionId: primaryCollection ? toBareId(primaryCollection.id) : null,
    collectionTitle: primaryCollection?.title ?? null,
    categoryId: node.category ? toBareId(node.category.id) : null,
    categoryFullName: node.category?.fullName ?? null,
    seoTitle: node.seo.title,
    seoDescription: node.seo.description,
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
          featuredImage {
            url
          }
          media(first: 10) {
            nodes {
              ... on MediaImage {
                image {
                  url
                }
              }
            }
          }
          collections(first: 1) {
            edges {
              node {
                id
                title
              }
            }
          }
          category {
            id
            fullName
          }
          seo {
            title
            description
          }
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
      const result: ShopifyRequestResult<RawProductsResponse> = await postShopifyGraphQL<RawProductsResponse>(
        shopDomain,
        accessToken,
        PRODUCTS_QUERY,
        { first: PAGE_SIZE, after }
      );

      if (!result.ok) {
        return result.reason === "http-error"
          ? { success: false, error: `Product import fetch failed with status ${result.status}` }
          : { success: false, error: `Product import request failed: ${result.message}` };
      }

      const page: RawProductsPage | undefined = result.body.data?.products;
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
