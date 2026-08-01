import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Shopify's CDN is a single shared host across every store (confirmed
    // against real imported data, not assumed) — product-table.tsx and
    // product-form.tsx previously avoided next/image specifically because
    // this wasn't verified yet.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      // Unit 12: each Vercel Blob store gets a random subdomain (confirmed
      // against a real uploaded file's URL), so this needs a wildcard, not
      // a fixed hostname.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
    // Both remote sources above are already CDN-served (Shopify's own CDN,
    // Vercel Blob's public storage CDN) — routing them through Next's own
    // Image Optimization proxy on top of that added no real benefit and, in
    // practice, its fetch to cdn.shopify.com was timing out entirely
    // (`/_next/image` 500s), breaking every product image in the editor and
    // preview. Skipping Next's re-optimization removes that failure point;
    // next/image still handles layout/sizing, just without the extra hop.
    unoptimized: true,
  },
};

export default nextConfig;
