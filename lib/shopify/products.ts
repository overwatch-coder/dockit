import { postShopifyGraphQL, type ShopifyRequestResult } from "./client";
import { resolveProductTaxonomyCategory } from "./taxonomy";

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

export type ShopifyPreviewProduct = {
  id: string; // "gid://shopify/Product/123"
  shopifyProductId: string; // bare ID "123"
  title: string;
  status: "ACTIVE" | "DRAFT";
  imageUrl: string | null;
  categoryFullName: string | null;
  collectionTitle: string | null;
};

export type ShopifyPreviewPage = {
  items: ShopifyPreviewProduct[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

export type ProductsFetchResult =
  | { success: true; data: ShopifyImportedProduct[] }
  | { success: false; error: string; status?: number };

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
  media: { nodes: { image?: { url: string } | null }[] };
  collections: { edges: { node: { id: string; title: string } }[] };
  category: { id: string; fullName: string } | null;
  productType?: string | null;
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

type RawNodesResponse = {
  data?: {
    nodes?: (RawProductNode | null)[];
  };
};

type RawPreviewNode = {
  id: string;
  title: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  featuredImage: { url: string } | null;
  category: { id: string; fullName: string } | null;
  productType?: string | null;
  collections: { edges: { node: { id: string; title: string } }[] };
};

type RawPreviewResponse = {
  data?: {
    products?: {
      nodes: RawPreviewNode[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
};

// Strips a Shopify GID ("gid://shopify/Product/123") down to the bare
// numeric id, which is what gets stored on Product.shopifyProductId (and,
// via lib/shopify/collections.ts, Product.collectionId).
export function toBareId(gid: string): string {
  return gid.split("/").pop() ?? gid;
}

// Schema's ProductStatus enum only has DRAFT | ACTIVE, so Shopify's
// ARCHIVED collapses into DRAFT — a deliberate simplification, not an oversight.
function toProductStatus(status: RawProductNode["status"]): "ACTIVE" | "DRAFT" {
  return status === "ACTIVE" ? "ACTIVE" : "DRAFT";
}

function toImportedProduct(node: RawProductNode): ShopifyImportedProduct {
  const primaryCollection = node.collections.edges[0]?.node ?? null;

  let categoryId = node.category ? toBareId(node.category.id) : null;
  let categoryFullName = node.category?.fullName ?? null;

  if (!categoryId || !categoryFullName) {
    const resolved = resolveProductTaxonomyCategory({
      title: node.title,
      productType: node.productType,
      tags: node.tags,
    });
    if (resolved) {
      categoryId = toBareId(resolved.id);
      categoryFullName = resolved.fullName;
    }
  }

  return {
    shopifyProductId: toBareId(node.id),
    title: node.title,
    description: node.descriptionHtml || null,
    imageUrl: node.featuredImage?.url ?? null,
    imageUrls: node.media.nodes
      .map((media) => media.image?.url)
      .filter((url): url is string => Boolean(url)),
    price: node.priceRangeV2.minVariantPrice.amount,
    status: toProductStatus(node.status),
    tags: node.tags,
    collectionId: primaryCollection ? toBareId(primaryCollection.id) : null,
    collectionTitle: primaryCollection?.title ?? null,
    categoryId,
    categoryFullName,
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

const PRODUCT_FIELDS = `
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
  collections(first: 5) {
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
  productType
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
`;

const PRODUCTS_QUERY = `
  query ImportProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          ${PRODUCT_FIELDS}
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const NODES_BY_IDS_QUERY = `
  query FetchProductsByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        ${PRODUCT_FIELDS}
      }
    }
  }
`;

const PREVIEW_QUERY = `
  query CatalogPreview($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      nodes {
        id
        title
        status
        featuredImage {
          url
        }
        category {
          id
          fullName
        }
        productType
        collections(first: 1) {
          edges {
            node {
              id
              title
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

// Pulls every product from a store's catalog, following Shopify's cursor pagination
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
        if (result.reason === "http-error") {
          if (result.status === 401) {
            return {
              success: false,
              error: "Shopify authorization expired or revoked (HTTP 401). Please reconnect in Settings.",
              status: 401,
            };
          }
          if (result.status === 404) {
            return {
              success: false,
              error: "Shopify store not found or deleted (HTTP 404). Check domain in Settings.",
              status: 404,
            };
          }
          return {
            success: false,
            error: `Product import fetch failed with status ${result.status}`,
            status: result.status,
          };
        }
        return { success: false, error: `Product import request failed: ${result.message}` };
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

// Fetches specific products by their Shopify IDs (bare IDs or GIDs)
export async function fetchProductsByIds(
  shopDomain: string,
  accessToken: string,
  productIds: string[]
): Promise<ProductsFetchResult> {
  if (productIds.length === 0) {
    return { success: true, data: [] };
  }

  const gids = productIds.map((id) =>
    id.startsWith("gid://shopify/Product/") ? id : `gid://shopify/Product/${id}`
  );

  try {
    const result: ShopifyRequestResult<RawNodesResponse> = await postShopifyGraphQL<RawNodesResponse>(
      shopDomain,
      accessToken,
      NODES_BY_IDS_QUERY,
      { ids: gids }
    );

    if (!result.ok) {
      if (result.reason === "http-error") {
        if (result.status === 401) {
          return {
            success: false,
            error: "Shopify authorization expired or revoked (HTTP 401). Please reconnect in Settings.",
            status: 401,
          };
        }
        if (result.status === 404) {
          return {
            success: false,
            error: "Shopify store not found or deleted (HTTP 404). Check domain in Settings.",
            status: 404,
          };
        }
        return {
          success: false,
          error: `Product fetch failed with status ${result.status}`,
          status: result.status,
        };
      }
      return { success: false, error: `Product fetch request failed: ${result.message}` };
    }

    const nodes = result.body.data?.nodes;
    if (!nodes) {
      return { success: false, error: "Product fetch returned an unexpected response shape" };
    }

    const validProducts = nodes
      .filter((node): node is RawProductNode => Boolean(node && "id" in node && "title" in node))
      .map(toImportedProduct);

    return { success: true, data: validProducts };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Product fetch request failed: ${message}` };
  }
}

// Backs the selective import/sync modal preview
export async function previewShopifyProducts(
  shopDomain: string,
  accessToken: string,
  query?: string,
  after?: string | null,
  limit = 24
): Promise<
  | { success: true; data: ShopifyPreviewPage }
  | { success: false; error: string; status?: number }
> {
  const trimmed = query?.trim();
  const searchFilter = trimmed
    ? `title:*${trimmed.replace(/[\\":()*]/g, "\\$&")}*`
    : null;

  try {
    const result = await postShopifyGraphQL<RawPreviewResponse>(
      shopDomain,
      accessToken,
      PREVIEW_QUERY,
      { first: limit, after: after || null, query: searchFilter }
    );

    if (!result.ok) {
      if (result.reason === "http-error") {
        return {
          success: false,
          error: `Shopify preview failed with status ${result.status}`,
          status: result.status,
        };
      }
      return { success: false, error: `Shopify preview request failed: ${result.message}` };
    }

    const products = result.body.data?.products;
    if (!products) {
      return { success: false, error: "Preview response had an unexpected shape" };
    }

    const items: ShopifyPreviewProduct[] = products.nodes.map((node) => {
      const primaryCollection = node.collections.edges[0]?.node ?? null;
      let categoryFullName = node.category?.fullName ?? null;
      if (!categoryFullName) {
        const resolved = resolveProductTaxonomyCategory({
          title: node.title,
          productType: node.productType,
        });
        if (resolved) {
          categoryFullName = resolved.fullName;
        }
      }

      return {
        id: node.id,
        shopifyProductId: toBareId(node.id),
        title: node.title,
        status: toProductStatus(node.status),
        imageUrl: node.featuredImage?.url ?? null,
        categoryFullName,
        collectionTitle: primaryCollection?.title ?? null,
      };
    });

    return {
      success: true,
      data: {
        items,
        pageInfo: products.pageInfo,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Shopify preview request failed: ${message}` };
  }
}

