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
export function shopifyThumbnailUrl(url: string, size: number): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Not a parseable absolute URL (relative path, blob:, empty string,
    // etc.) — nothing safe to append params to, return unchanged rather
    // than risk producing a broken src.
    return url;
  }
  parsed.searchParams.set("width", String(size));
  parsed.searchParams.set("height", String(size));
  return parsed.toString();
}
