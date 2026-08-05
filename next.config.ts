import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16.3: Instant Navigations (cacheComponents + partialPrefetching)
  // was attempted and fully reverted this session — a real, reproducible
  // finding, not a preference. With it enabled, `next build` never once
  // completed successfully: `/sign-in`/`/sign-up` (Clerk's
  // <Show>/<SignIn>/<SignUp> components under an optional catch-all route)
  // crashed the prerender worker with no error body, reproducibly, across
  // ~8 full-build attempts varying cpus, the React Compiler, the filesystem
  // build cache, and an explicit generateStaticParams — none of which fixed
  // it reliably. `/` itself did convert cleanly to a real static shell
  // (required a "use cache"-wrapped copyright-year helper and Suspense
  // boundaries around <Show>, since <Show> reads auth cookies), but since
  // "use cache" and the Cache Components validation it depends on only
  // exist when cacheComponents is on, all of that only made sense together
  // with the flag — reverted alongside it rather than left in as dead code.
  // Documented in context/progress-tracker.md's Open Questions as a real
  // blocker to revisit on a future Next.js patch, not silently dropped.
  // Next.js 16.3: the Rust-native React Compiler, running inside Turbopack.
  // Automatic render-phase memoization — doesn't need babel-plugin-react-
  // compiler (that's only required for the Babel path) since it runs
  // natively. Still experimental upstream; verified via a full build/lint/
  // test pass, not just assumed safe.
  reactCompiler: true,
  experimental: {
    // Server Actions cap request bodies at 1MB by default (Next 16 docs,
    // node_modules/next/dist/docs/01-app/02-guides/server-actions.md) — too
    // small for a product image upload. Matches MAX_IMAGE_BYTES in
    // app/(dashboard)/products/actions.ts, which already validates images up
    // to 5MB; that check was silently unreachable without this.
    serverActions: {
      bodySizeLimit: "5mb",
    },
    // Next.js 16.3: selects the Rust React Compiler implementation (requires
    // reactCompiler: true above; this only picks which engine runs it).
    turbopackRustReactCompiler: true,
    // Next.js 16.3: a failed Server Action or soft navigation (network drop
    // mid-request) stays pending and auto-retries once the connection
    // returns, instead of throwing. Real value here independent of Cache
    // Components — this app's Save/Push-to-Shopify/image-upload/AI-generate
    // flows are all Server Actions. Paired with components/offline-banner.tsx
    // (mounted in app/layout.tsx) so the owner sees why something looks
    // stuck instead of it silently hanging.
    useOffline: true,
  },
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
