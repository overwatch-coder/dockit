import { toBareId } from "./products";
import { postShopifyGraphQL } from "./client";
// Uses lib/blob/products.ts's isBlobUrl (.public.blob.vercel-storage.com hostname check)
// as the designated classifier for Blob URLs across push and storage boundaries.
import { isBlobUrl } from "@/lib/blob/products";

// Everything needed to push one product's current app-side state onto Shopify
// via the productSet mutation — a single mutation that creates or updates a product's
// core fields, variants, media, and collection membership in one call.
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
  categoryId: string | null; // bare TaxonomyCategory id; null = never touch category
  imageUrls: string[]; // full current gallery, Blob and/or Shopify-CDN mixed
  metafields?: {
    namespace: string;
    key: string;
    value: string;
    type?: string;
  }[];
  variants: {
    id: string;
    shopifyVariantId: string | null;
    optionName: string;
    price: string;
    inventory: number;
    // One entry from imageUrls above (Blob or already-Shopify), or
    // null/undefined for no variant-specific image. Optional so this input
    // shape stays backward compatible for callers that build a variant literal without it.
    imageUrl?: string | null;
    colorHex?: string | null;
  }[];
};

export type PushedVariant = { localVariantId: string; shopifyVariantId: string };

export type PushProductResult = {
  shopifyProductId: string;
  variants: PushedVariant[];
  // Same length/order as input.imageUrls — each Blob-origin entry replaced
  // with its new Shopify CDN url, each already-Shopify entry left as-is.
  mediaUrls: string[];
  // Only variants whose imageUrl needs to change in the app's own record after
  // this push — a variant linked to a brand-new (Blob-origin) image, now promoted
  // to its permanent Shopify CDN url, matching the remap mediaUrls does at the product level.
  variantImageUpdates: { localVariantId: string; imageUrl: string }[];
};

type PushResult = { success: true; data: PushProductResult } | { success: false; error: string };
type LocationResult = { success: true; data: string } | { success: false; error: string };

function toGid(
  type: "Product" | "ProductVariant" | "Collection" | "Location" | "TaxonomyCategory",
  bareId: string
): string {
  return bareId.startsWith("gid://") ? bareId : `gid://shopify/${type}/${bareId}`;
}

// Not exported — every lib/shopify/ file makes one or more GraphQL calls via
// the shared lib/shopify/client.ts transport (which owns retry-with-backoff
// for rate limits); push.ts needs several distinct calls (locations, the
// mutation, a media read-back retry), so this small private helper avoids
// repeating THIS file's own error-shape boilerplate (sanitizing top-level
// GraphQL errors, checking for `data`) four times within this one file.
async function postGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const result = await postShopifyGraphQL<{ data?: T; errors?: { message: string }[] }>(
    shopDomain,
    accessToken,
    query,
    variables
  );

  if (!result.ok) {
    return result.reason === "http-error"
      ? { success: false, error: `Shopify request failed with status ${result.status}` }
      : { success: false, error: `Shopify request failed: ${result.message}` };
  }

  const body = result.body;
  if (body.errors?.length) {
    // Top-level GraphQL `errors` (as opposed to productSet's own
    // `userErrors`) are always protocol-level failures — malformed
    // variables, schema/type mismatches, auth issues — never messages
    // Shopify wrote for end-user display (e.g. "Variable $input of type
    // ProductSetInput! was provided invalid value for
    // variants.0.optionValues..."). Logging the real message server-side
    // and returning a generic one keeps that GraphQL-internal detail out
    // of the push results dialog the owner actually sees. `userErrors`
    // (handled separately in pushProductToShopify, below) ARE meant for
    // display and are left untouched.
    const technicalMessage = body.errors.map((e) => e.message).join("; ");
    console.error(`Shopify GraphQL error (${shopDomain}): ${technicalMessage}`);
    return {
      success: false,
      error: "Shopify rejected the request due to invalid product data. Check the title, price, and variants, then try again.",
    };
  }
  if (!body.data) {
    return { success: false, error: "Shopify response had no data" };
  }
  return { success: true, data: body.data };
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
        category {
          id
        }
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

const MEDIA_READY_RETRIES = 15;
const MEDIA_READY_DELAY_MS = 1500;

// Shopify processes newly attached media asynchronously — status may come
// back UPLOADED or PROCESSING rather than READY, with image.url not yet populated,
// the instant productSet returns. Increased retries ensure large generated images
// have sufficient time to transcode on Shopify's CDN without aborting a successful
// product creation.
async function resolveNewMediaUrls(
  shopDomain: string,
  accessToken: string,
  productGid: string,
  beforeMediaIds: Set<string>,
  expectedNewCount: number
): Promise<{ success: true; data: string[] } | { success: false; error: string }> {
  let lastResolvedUrls: string[] = [];

  for (let attempt = 0; attempt < MEDIA_READY_RETRIES; attempt++) {
    const media = await fetchProductMedia(shopDomain, accessToken, productGid);
    if (!media.success) return media;

    const newNodes = media.data.filter((node) => !beforeMediaIds.has(node.id));
    const resolvedUrls = newNodes
      .map((node) => node.image?.url)
      .filter((url): url is string => Boolean(url));

    lastResolvedUrls = resolvedUrls;

    // Fast-path: all new media items are ready with CDN URLs
    if (newNodes.length >= expectedNewCount && resolvedUrls.length >= expectedNewCount) {
      return { success: true, data: resolvedUrls.slice(0, expectedNewCount) };
    }

    if (attempt < MEDIA_READY_RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, MEDIA_READY_DELAY_MS));
    } else {
      // Reached max retries:
      // If Shopify has ingested the media nodes (or partially resolved CDN URLs),
      // accept whatever was resolved rather than failing the successful productSet mutation.
      if (resolvedUrls.length > 0) {
        return { success: true, data: resolvedUrls };
      }
      if (newNodes.length >= expectedNewCount) {
        console.warn(
          `resolveNewMediaUrls: Shopify media nodes for product ${productGid} are still processing; preserving staged URLs until next sync.`
        );
        return { success: true, data: [] };
      }
    }
  }

  if (lastResolvedUrls.length > 0) {
    return { success: true, data: lastResolvedUrls };
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
  const blobImageUrls = input.imageUrls.filter(isBlobUrl);

  // A variant linked to an image already on Shopify needs that image's real media id
  // (Shopify's ProductVariantSetInput.file takes a FileSetInput — a brand-new upload
  // via originalSource or an existing file id) — so media read-back is also needed
  // whenever a variant points at a non-Blob image.
  const hasExistingVariantImageLinks = input.variants.some(
    (variant) => variant.imageUrl && !isBlobUrl(variant.imageUrl)
  );

  let beforeMediaIds = new Set<string>();
  const existingMediaByUrl = new Map<string, string>();
  if (productGidForLookups && (blobImageUrls.length > 0 || hasExistingVariantImageLinks)) {
    const before = await fetchProductMedia(shopDomain, accessToken, productGidForLookups);
    if (!before.success) return before;
    beforeMediaIds = new Set(before.data.map((node) => node.id));
    for (const node of before.data) {
      if (node.image?.url) existingMediaByUrl.set(node.image.url, node.id);
    }
  }

  const newLocalVariants = input.variants.filter((v) => v.shopifyVariantId === null);

  const productSetInput: Record<string, unknown> = {
    title: input.title,
    descriptionHtml: input.descriptionHtml ?? "",
    status: input.status,
    tags: input.tags,
    seo: { title: input.seoTitle, description: input.seoDescription },
  };

  // Bugfix: this used to only send productOptions/optionValues when the
  // product had explicit local variants, falling back to a bare
  // `{ price }` variant with no productOptions at all otherwise. Updating
  // an EXISTING Shopify product that already has an option configured (from
  // an earlier push with variants, or from a prior update using this same
  // shape) with that bare payload produced a GraphQL variable-coercion
  // error ("variants.0.optionValues ... Expected value to not be null")
  // instead of a clean userError, because the payload no longer matched the
  // option structure Shopify already had on file for that product. Always
  // sending a consistent productOptions + optionValues shape — a synthetic
  // single "Default Title" variant when there are no explicit local
  // variants, matching Shopify's own default-variant convention — removes
  // that mismatch. Blank or duplicate variant names are also normalized
  // here rather than sent through: Shopify silently collapses duplicate
  // option values, which would desync a later variant's optionValues.name
  // from what Shopify actually created.
  const seenOptionNames = new Set<string>();
  const normalizedVariants = (
    input.variants.length > 0
      ? input.variants
      : [{ id: "", shopifyVariantId: null, optionName: "Default Title", price: input.price, inventory: 0 }]
  ).map((variant) => {
    let name = variant.optionName.trim() || "Default Title";
    if (seenOptionNames.has(name)) {
      let suffix = 2;
      while (seenOptionNames.has(`${name} (${suffix})`)) suffix++;
      name = `${name} (${suffix})`;
    }
    seenOptionNames.add(name);
    return { ...variant, optionName: name };
  });

  productSetInput.productOptions = [
    { name: "Title", position: 1, values: normalizedVariants.map((v) => ({ name: v.optionName })) },
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
  // Resolves one variant's imageUrl into the FileSetInput ProductVariantSetInput.file expects — either a brand-new upload
  // (originalSource, for a Blob-origin image already being uploaded this
  // push) or a reference to an already-attached Shopify file (id, looked up
  // above). Shopify's own docs (shopify.dev/docs/api/admin-graphql/latest/
  // input-objects/ProductVariantSetInput, field `file`) state: "Any file
  // specified here must also be specified in the `files` input for the
  // product" — so every existing-file id resolved here also has to be
  // collected into productSetInput.files below, not just the new uploads
  // that already went there. Returns undefined (no file field sent, leaving
  // whatever's already linked on Shopify untouched) for no image, or for an
  // image this push can't currently resolve to a real Shopify file — logged
  // as a diagnostic rather than failing the whole push, same "don't hard-
  // fail on an unconfirmed Shopify-side edge case" convention as the
  // category-mismatch diagnostic below.
  const extraFileEntries: { id: string }[] = [];
  const seenExtraFileIds = new Set<string>();
  function resolveVariantFile(imageUrl: string | null | undefined): { id: string } | { originalSource: string; contentType: "IMAGE" } | undefined {
    if (!imageUrl) return undefined;
    if (isBlobUrl(imageUrl)) {
      if (!blobImageUrls.includes(imageUrl)) {
        console.error(
          `pushProductToShopify: variant references a staged image (${imageUrl}) that isn't part of this product's current gallery — skipping its media link.`
        );
        return undefined;
      }
      return { originalSource: imageUrl, contentType: "IMAGE" };
    }
    const mediaId = existingMediaByUrl.get(imageUrl);
    if (!mediaId) {
      console.error(
        `pushProductToShopify: could not resolve a Shopify media id for variant image ${imageUrl} — skipping its media link this push.`
      );
      return undefined;
    }
    if (!seenExtraFileIds.has(mediaId)) {
      seenExtraFileIds.add(mediaId);
      extraFileEntries.push({ id: mediaId });
    }
    return { id: mediaId };
  }

  productSetInput.variants = normalizedVariants.map((v) => {
    const file = resolveVariantFile(v.imageUrl);
    const variantMetafields: { namespace: string; key: string; value: string; type: string }[] = [];
    if ("colorHex" in v && v.colorHex) {
      variantMetafields.push({
        namespace: "shopify",
        key: "color-pattern",
        type: "json",
        value: JSON.stringify({ color: v.colorHex }),
      });
      variantMetafields.push({
        namespace: "custom",
        key: "color",
        type: "single_line_text_field",
        value: v.colorHex,
      });
    }
    return {
      ...(v.shopifyVariantId ? { id: toGid("ProductVariant", v.shopifyVariantId) } : {}),
      price: v.price,
      optionValues: [{ optionName: "Title", name: v.optionName }],
      ...(file ? { file } : {}),
      ...(variantMetafields.length > 0 ? { metafields: variantMetafields } : {}),
    };
  });

  // Never touches collection membership when the app has no opinion —
  // productSet's `collections` field is a full-replacement list, so sending
  // it when collectionId is null would strip the product out of every
  // Shopify collection it belongs to, including ones this app doesn't track
  // (it only ever models one "primary" collection per product).
  if (input.collectionId) {
    productSetInput.collections = [toGid("Collection", input.collectionId)];
  }

  // Same "only write when we have an opinion" convention as collectionId
  // above — sending no category field at all leaves whatever's already on
  // Shopify untouched, rather than risking clearing it.
  if (input.categoryId) {
    productSetInput.category = toGid("TaxonomyCategory", input.categoryId);
  }

  if (input.metafields && input.metafields.length > 0) {
    productSetInput.metafields = input.metafields
      .filter((m) => m.value && m.value.trim() !== "")
      .map((m) => ({
        namespace: m.namespace,
        key: m.key,
        value: m.value,
        ...(m.type ? { type: m.type } : {}),
      }));
  }

  // extraFileEntries (existing files a variant links to) is only populated
  // by the productSetInput.variants pass above, so this runs after it —
  // merged with the new-upload entries.
  const fileEntries: ({ id: string } | { originalSource: string; contentType: "IMAGE" })[] = [
    ...blobImageUrls.map((url) => ({ originalSource: url, contentType: "IMAGE" as const })),
    ...extraFileEntries,
  ];
  if (fileEntries.length > 0) {
    productSetInput.files = fileEntries;
  }

  const variables: Record<string, unknown> = { input: productSetInput };
  if (isUpdate) {
    variables.identifier = { id: productGidForLookups };
  }

  const result = await postGraphQL<{
    productSet: {
      product:
        | { id: string; category: { id: string } | null; variants: { nodes: { id: string; title: string }[] } }
        | null;
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

  // Diagnostic, not a hard failure: Shopify has a documented history of
  // productSet returning success with userErrors empty while silently not
  // applying the category field (community-reported, not something this
  // app's own request shape controls) — logging a mismatch here surfaces it
  // server-side immediately instead of only being discoverable by manually
  // comparing against Shopify admin later.
  if (input.categoryId) {
    const echoedCategoryId = product.category ? toBareId(product.category.id) : null;
    if (echoedCategoryId !== input.categoryId) {
      console.error(
        `pushProductToShopify: category mismatch after productSet — sent ${input.categoryId}, Shopify echoed back ${echoedCategoryId ?? "null"} for product ${toBareId(product.id)}`
      );
    }
  }

  const shopifyProductId = toBareId(product.id);

  const existingVariants: PushedVariant[] = input.variants
    .filter((v) => v.shopifyVariantId !== null)
    .map((v) => ({ localVariantId: v.id, shopifyVariantId: v.shopifyVariantId! }));
  // Match against the normalized names actually sent to Shopify (a blank or
  // duplicate optionName gets renamed above), not the raw local ones —
  // otherwise a renamed variant would never find its remote counterpart by
  // title.
  const normalizedNameByLocalId = new Map(normalizedVariants.map((v) => [v.id, v.optionName]));
  const newLocalVariantsForMatching = newLocalVariants.map((v) => ({
    ...v,
    optionName: normalizedNameByLocalId.get(v.id) ?? v.optionName,
  }));
  const matchedNewVariants = matchNewVariants(newLocalVariantsForMatching, product.variants.nodes);
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
  // already-Shopify entry left untouched. Also records the blob-url -> new-CDN-url
  // mapping this loop discovers, so a variant linked to one of these promoted
  // images can be remapped the same way below instead of pointing to a deleted Blob URL.
  let blobIndex = 0;
  const blobUrlToNewUrl = new Map<string, string>();
  const mediaUrls = input.imageUrls.map((url) => {
    if (!isBlobUrl(url)) return url;
    const newUrl = newMediaUrls[blobIndex++] ?? url;
    blobUrlToNewUrl.set(url, newUrl);
    return newUrl;
  });

  const variantImageUpdates: { localVariantId: string; imageUrl: string }[] = [];
  for (const variant of input.variants) {
    if (!variant.imageUrl) continue;
    const remapped = blobUrlToNewUrl.get(variant.imageUrl);
    if (remapped) {
      variantImageUpdates.push({ localVariantId: variant.id, imageUrl: remapped });
    }
  }

  return {
    success: true,
    data: { shopifyProductId, variants: pushedVariants, mediaUrls, variantImageUpdates },
  };
}
