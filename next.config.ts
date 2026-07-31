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
  },
};

export default nextConfig;
