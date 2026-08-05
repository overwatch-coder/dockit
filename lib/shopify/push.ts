import { toBareId } from "./products";

const ADMIN_API_VERSION = "2026-07";

// Unit 15: everything needed to push one product's current app-side state
// onto Shopify via the productSet mutation (verified against shopify.dev
// during planning — a single mutation that can create-or-update a product's
// core fields, variants, media, and collection membership in one call,
// rather than the older productCreate/productUpdate + productVariantsBulk*
// + productCreateMedia + collectionAddProducts chain).
export type PushProductInput = {
  shopifyProductId: string | null; // null = create a new product
  title: string;
  descriptionHtml: string | null;
  status: "ACTIVE" | "DRAFT";
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  price: string; // only used when variants is empty
  collectionId: string | null; // bare id; null = never touch collection membership
  imageUrls: string[]; // full current gallery, Blob and/or Shopify-CDN mixed
  variants: {
    id: string;
    shopifyVariantId: string | null;
    optionName: string;
    price: string;
    inventory: number;
  }[];
};

export type PushedVariant = { localVariantId: string; shopifyVariantId: string };

export type PushProductResult = {
  shopifyProductId: string;
  variants: PushedVariant[];
  // Same length/order as input.imageUrls — each Blob-origin entry replaced
  // with its new Shopify CDN url, each already-Shopify entry left as-is.
  mediaUrls: string[];
};

type PushResult = { success: true; data: PushProductResult } | { success: false; error: string };
type LocationResult = { success: true; data: string } | { success: false; error: string };

function toGid(type: "Product" | "ProductVariant" | "Collection" | "Location", bareId: string): string {
  return bareId.startsWith("gid://") ? bareId : `gid://shopify/${type}/${bareId}`;
}

function isBlobOrigin(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

// Not exported — every lib/shopify/ file so far (products.ts, collections.ts)
// makes one GraphQL call per exported function via an inline fetch; push.ts
// needs several distinct calls (locations, the mutation, a media read-back
// retry), so this small private helper avoids repeating the fetch/headers/
// error-shape boilerplate four times within this one file. Not shared across
// files — each file still owns its own ADMIN_API_VERSION constant, matching
// the existing convention.
async function postGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const response = await fetch(`https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    // Scope call: a single narrow retry-once on a 429, not general backoff —
    // no existing lib/shopify/ function has retry logic yet (fetchAllProducts,
    // fetchAllCollections are both retry-free), so full exponential backoff
    // is beyond established precedent for this codebase.
    // TODO: generalize rate-limit retry once a second mutation needs it.
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return postGraphQL<T>(shopDomain, accessToken, query, variables);
    }

    if (!response.ok) {
      return { success: false, error: `Shopify request failed with status ${response.status}` };
    }

    const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
    if (body.errors?.length) {
      return { success: false, error: body.errors.map((e) => e.message).join("; ") };
    }
    if (!body.data) {
      return { success: false, error: "Shopify response had no data" };
    }
    return { success: true, data: body.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Shopify request failed: ${message}` };
  }
}

const LOCATIONS_QUERY = `
  query PrimaryLocation {
    locations(first: 1) {
      edges { node { id } }
    }
  }
`;

// Scope call: this app has no location-management concept anywhere in its
// schema/UI, so push resolves "the" location as whichever comes back first —
// correct for the connected single-location "Adage" store, not modeled for
// multi-location merchants.
export async function fetchPrimaryLocationId(
  shopDomain: string,
  accessToken: string
): Promise<LocationResult> {
  const result = await postGraphQL<{ locations: { edges: { node: { id: string } }[] } }>(
    shopDomain,
    accessToken,
    LOCATIONS_QUERY,
    {}
  );
  if (!result.success) return result;

  const node = result.data.locations.edges[0]?.node;
  if (!node) {
    return { success: false, error: "Store has no locations configured" };
  }
  return { success: true, data: toBareId(node.id) };
}

const PRODUCT_SET_MUTATION = `
  mutation PushProduct($input: ProductSetInput!, $identifier: ProductSetIdentifiers) {
    productSet(synchronous: true, input: $input, identifier: $identifier) {
      product {
        id
        variants(first: 100) {
          nodes { id title }
        }
      }
      userErrors { field message code }
    }
  }
`;

const PRODUCT_MEDIA_QUERY = `
  query ProductMedia($id: ID!) {
    product(id: $id) {
      media(first: 50) {
        nodes {
          id
          status
          ... on MediaImage {
            image { url }
          }
        }
      }
    }
  }
`;

type RawMediaNode = { id: string; status: string; image?: { url: string } | null };

async function fetchProductMedia(
  shopDomain: string,
  accessToken: string,
  productGid: string
): Promise<{ success: true; data: RawMediaNode[] } | { success: false; error: string }> {
  const result = await postGraphQL<{ product: { media: { nodes: RawMediaNode[] } } | null }>(
    shopDomain,
    accessToken,
    PRODUCT_MEDIA_QUERY,
    { id: productGid }
  );
  if (!result.success) return result;
  if (!result.data.product) {
    return { success: false, error: "Product not found when reading back media" };
  }
  return { success: true, data: result.data.product.media.nodes };
}

// Best-effort match of each local variant to the GID Shopify assigned it.
// Existing variants (shopifyVariantId already known) don't need matching at
// all. Brand-new variants are matched to the mutation's returned variants by
// title (productSet's single-option mapping sets each variant's title to its
// optionName), falling back to positional assignment for any leftover —
// title collisions between variants on the same product are already an
// unusual data state, not something this app validates against elsewhere.
function matchNewVariants(
  newLocalVariants: PushProductInput["variants"],
  remoteVariants: { id: string; title: string }[]
): PushedVariant[] {
  const remaining = [...remoteVariants];
  const matched: PushedVariant[] = [];

  for (const local of newLocalVariants) {
    const index = remaining.findIndex((remote) => remote.title === local.optionName);
    if (index !== -1) {
      matched.push({ localVariantId: local.id, shopifyVariantId: toBareId(remaining[index].id) });
      remaining.splice(index, 1);
    }
  }

  const unmatched = newLocalVariants.filter((local) => !matched.some((m) => m.localVariantId === local.id));
  for (let i = 0; i < unmatched.length && i < remaining.length; i++) {
    matched.push({ localVariantId: unmatched[i].id, shopifyVariantId: toBareId(remaining[i].id) });
  }

  return matched;
}

const MEDIA_READY_RETRIES = 3;
const MEDIA_READY_DELAY_MS = 1000;

// Shopify processes newly attached media asynchronously — status may come
// back UPLOADED rather than READY, with image.url not yet populated, the
// instant productSet returns. Scope call: a small bounded retry against a
// plain read query, not full async/webhook handling.
async function resolveNewMediaUrls(
  shopDomain: string,
  accessToken: string,
  productGid: string,
  beforeMediaIds: Set<string>,
  expectedNewCount: number
): Promise<{ success: true; data: string[] } | { success: false; error: string }> {
  for (let attempt = 0; attempt < MEDIA_READY_RETRIES; attempt++) {
    const media = await fetchProductMedia(shopDomain, accessToken, productGid);
    if (!media.success) return media;

    const newNodes = media.data.filter((node) => !beforeMediaIds.has(node.id));
    const resolvedUrls = newNodes.map((node) => node.image?.url).filter((url): url is string => Boolean(url));

    if (newNodes.length >= expectedNewCount && resolvedUrls.length >= expectedNewCount) {
      return { success: true, data: resolvedUrls.slice(0, expectedNewCount) };
    }

    if (attempt < MEDIA_READY_RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, MEDIA_READY_DELAY_MS));
    }
  }
  return { success: false, error: "Timed out waiting for Shopify to finish processing new images" };
}

export async function pushProductToShopify(
  shopDomain: string,
  accessToken: string,
  input: PushProductInput
): Promise<PushResult> {
  const isUpdate = input.shopifyProductId !== null;
  const productGidForLookups = isUpdate ? toGid("Product", input.shopifyProductId!) : null;

  // Scope call: only NEW (Blob-origin) images are ever submitted as `files`.
  // productSet's documented behavior for `files` on an existing product
  // (replace vs. additive) isn't specified anywhere in Shopify's current
  // docs (checked during planning) — resubmitting already-Shopify-hosted
  // URLs risks either duplicating media (if additive) or is simply
  // unnecessary (the image is already attached either way), so this is the
  // conservative choice, verified empirically against the real connected
  // store as part of this unit's live verification pass.
  const blobImageUrls = input.imageUrls.filter(isBlobOrigin);

  let beforeMediaIds = new Set<string>();
  if (blobImageUrls.length > 0 && productGidForLookups) {
    const before = await fetchProductMedia(shopDomain, accessToken, productGidForLookups);
    if (!before.success) return before;
    beforeMediaIds = new Set(before.data.map((node) => node.id));
  }

  const hasVariants = input.variants.length > 0;
  const newLocalVariants = input.variants.filter((v) => v.shopifyVariantId === null);

  const productSetInput: Record<string, unknown> = {
    title: input.title,
    descriptionHtml: input.descriptionHtml ?? "",
    status: input.status,
    tags: input.tags,
    seo: { title: input.seoTitle, description: input.seoDescription },
  };

  if (hasVariants) {
    productSetInput.productOptions = [
      { name: "Title", position: 1, values: input.variants.map((v) => ({ name: v.optionName })) },
    ];
    // Scope call: inventory quantities are NOT set here. Doing so requires
    // the locations query, which needs a read_locations OAuth scope this
    // app's connected store token doesn't currently have (confirmed live —
    // "Access denied for locations field" — SHOPIFY_SCOPES is only
    // read_products,write_products today). This app also has no
    // inventory-management concept anywhere else in its schema/UI beyond
    // Variant.inventory as a plain stored number, so this is a reasonable
    // scope cut rather than blocking push on an OAuth reconnect mid-unit —
    // real inventory sync can be added later alongside read_locations/
    // write_inventory once the store token is reconnected with that scope.
    productSetInput.variants = input.variants.map((v) => ({
      ...(v.shopifyVariantId ? { id: toGid("ProductVariant", v.shopifyVariantId) } : {}),
      price: v.price,
      optionValues: [{ optionName: "Title", name: v.optionName }],
    }));
  } else {
    // No explicit variants (Unit 11 scope) — still need one default variant
    // so Shopify has somewhere to put the product's price. No productOptions
    // sent, so Shopify creates its own implicit default option.
    productSetInput.variants = [{ price: input.price }];
  }

  // Never touches collection membership when the app has no opinion —
  // productSet's `collections` field is a full-replacement list, so sending
  // it when collectionId is null would strip the product out of every
  // Shopify collection it belongs to, including ones this app doesn't track
  // (it only ever models one "primary" collection per product).
  if (input.collectionId) {
    productSetInput.collections = [toGid("Collection", input.collectionId)];
  }

  if (blobImageUrls.length > 0) {
    productSetInput.files = blobImageUrls.map((url) => ({
      originalSource: url,
      contentType: "IMAGE",
    }));
  }

  const variables: Record<string, unknown> = { input: productSetInput };
  if (isUpdate) {
    variables.identifier = { id: productGidForLookups };
  }

  const result = await postGraphQL<{
    productSet: {
      product: { id: string; variants: { nodes: { id: string; title: string }[] } } | null;
      userErrors: { field: string[] | null; message: string; code: string }[];
    };
  }>(shopDomain, accessToken, PRODUCT_SET_MUTATION, variables);
  if (!result.success) return result;

  const { product, userErrors } = result.data.productSet;
  if (userErrors.length > 0) {
    return { success: false, error: userErrors.map((e) => e.message).join("; ") };
  }
  if (!product) {
    return { success: false, error: "Shopify returned no product from productSet" };
  }

  const shopifyProductId = toBareId(product.id);

  const existingVariants: PushedVariant[] = input.variants
    .filter((v) => v.shopifyVariantId !== null)
    .map((v) => ({ localVariantId: v.id, shopifyVariantId: v.shopifyVariantId! }));
  const matchedNewVariants = matchNewVariants(newLocalVariants, product.variants.nodes);
  const pushedVariants = [...existingVariants, ...matchedNewVariants];

  let newMediaUrls: string[] = [];
  if (blobImageUrls.length > 0) {
    const resolved = await resolveNewMediaUrls(
      shopDomain,
      accessToken,
      product.id,
      beforeMediaIds,
      blobImageUrls.length
    );
    if (!resolved.success) return resolved;
    newMediaUrls = resolved.data;
  }

  // Rebuild the gallery in the original relative order: each Blob-origin
  // entry replaced in place with its newly promoted CDN url, each
  // already-Shopify entry left untouched.
  let blobIndex = 0;
  const mediaUrls = input.imageUrls.map((url) => (isBlobOrigin(url) ? (newMediaUrls[blobIndex++] ?? url) : url));

  return {
    success: true,
    data: { shopifyProductId, variants: pushedVariants, mediaUrls },
  };
}
