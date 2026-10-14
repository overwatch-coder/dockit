// Products-page scroll-lag fix: table/list thumbnails were requesting
// product.imageUrl as-is — whatever original resolution Shopify returned at
// import/push time (lib/shopify/products.ts's toImportedProduct never
// resizes it), often a full product photo, downscaled only in CSS. The
// browser still has to download and decode the full image, and with
// `loading="lazy"` that work lands exactly as each row scrolls into view —
// real main-thread cost competing with paint during scroll.
//
// Shopify's CDN (cdn.shopify.com) supports on-the-fly resizing via `width`/
// `height` query params on any image URL it serves, confirmed against
// shopify.dev's img_url docs — no new dependency, no server-side work,
// just a smaller request. `size` is applied to both width and height (the
// CDN crops/fits to match, per Shopify's own docs) since every call site
// today is a square thumbnail box.
//
// Vercel Blob's public CDN (*.public.blob.vercel-storage.com) also supports
// `width` query param for image resizing — documented at vercel.com/docs/storage/vercel-blob.
// `shopifyThumbnailUrl` is kept as a backwards-compatible alias. All new code
// should call `productThumbnailUrl` which handles both sources.
function resizeImageUrl(url: string, width: number, height: number): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Not a parseable absolute URL (relative path, blob:, empty string,
    // etc.) — nothing safe to append params to, return unchanged rather
    // than risk producing a broken src.
    return url;
  }

  const hostname = parsed.hostname;
  const isShopify = hostname === "cdn.shopify.com";
  const isVercelBlob = hostname.endsWith(".public.blob.vercel-storage.com");

  if (isShopify) {
    parsed.searchParams.set("width", String(width));
    parsed.searchParams.set("height", String(height));
    return parsed.toString();
  }

  if (isVercelBlob) {
    // Vercel Blob image resizing: only width is needed (maintains aspect ratio)
    parsed.searchParams.set("width", String(width));
    return parsed.toString();
  }

  // Unknown CDN — return as-is rather than corrupt URL with unsupported params
  return url;
}

/** Resize a product image URL from any supported CDN (Shopify or Vercel Blob) to a square thumbnail. */
export function productThumbnailUrl(url: string, size: number): string {
  return resizeImageUrl(url, size, size);
}

/** @deprecated Use productThumbnailUrl instead — supports both Shopify CDN and Vercel Blob. */
export function shopifyThumbnailUrl(url: string, size: number): string {
  return resizeImageUrl(url, size, size);
}
