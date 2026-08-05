"use client";

import { useOffline } from "next/offline";
import { WifiOff } from "lucide-react";

// Next.js 16.3's experimental.useOffline (enabled in next.config.ts): a
// failed Server Action or soft navigation stays pending and auto-retries
// once the connection returns, instead of throwing — real value for this
// app's Save/Push-to-Shopify/image-upload/AI-generate flows, all Server
// Actions. Without this banner those flows would just look silently stuck;
// mounted once in the root layout so it's visible everywhere, matching the
// pattern in node_modules/next/dist/docs/01-app/02-guides/offline-support.md.
export function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning/10 px-4 py-2 text-sm text-warning"
    >
      <WifiOff className="size-4" />
      Offline — pending requests will retry once you&apos;re back online.
    </div>
  );
}
