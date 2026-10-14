"use client";

import { Globe } from "lucide-react";

export interface GoogleSerpPreviewProps {
  title?: string | null;
  description?: string | null;
  handle?: string | null;
  shopDomain?: string | null;
  siteName?: string | null;
  className?: string;
  showMetrics?: boolean;
}

export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyHandle(text: string): string {
  if (!text) return "product";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function GoogleSerpPreview({
  title,
  description,
  handle,
  shopDomain,
  siteName,
  className = "",
  showMetrics = true,
}: GoogleSerpPreviewProps) {
  const displaySiteName = siteName?.trim() || "Store";
  const displayDomain = (shopDomain?.trim() || "your-store.myshopify.com")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  const cleanTitle = (title?.trim() || "Product Title").slice(0, 70);
  const cleanDescription = stripHtml(description || "").slice(0, 160) ||
    "Discover this product with detailed specifications, verified customer reviews, and fast shipping.";

  const effectiveHandle = handle?.trim() ? slugifyHandle(handle) : slugifyHandle(cleanTitle);

  const titleLength = (title?.trim() || "").length;
  const descLength = stripHtml(description || "").length;

  return (
    <div
      className={`rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 text-left shadow-xs transition-colors space-y-2.5 ${className}`}
    >
      <div className="flex items-center justify-between text-xs border-b border-border/40 pb-2">
        <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px] uppercase tracking-wider">
          <Globe className="size-3 text-primary" />
          <span>Google Search Listing</span>
        </div>
        {showMetrics && (
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span
              className={
                titleLength > 60
                  ? "text-amber-500 font-semibold"
                  : titleLength >= 30
                    ? "text-emerald-500 font-semibold"
                    : "text-muted-foreground"
              }
            >
              Title: {titleLength}/60
            </span>
            <span>•</span>
            <span
              className={
                descLength > 160
                  ? "text-amber-500 font-semibold"
                  : descLength >= 100
                    ? "text-emerald-500 font-semibold"
                    : "text-muted-foreground"
              }
            >
              Desc: {descLength}/160
            </span>
          </div>
        )}
      </div>

      {/* URL Breadcrumb Line */}
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted border border-border/70 text-foreground font-bold text-xs">
          {displaySiteName.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-xs font-medium text-foreground truncate">
            {displaySiteName}
          </span>
          <span className="text-[11px] text-muted-foreground truncate font-mono">
            https://{displayDomain} › products › {effectiveHandle}
          </span>
        </div>
      </div>

      {/* Blue Title Link */}
      <div className="pt-0.5">
        <h3 className="text-sm sm:text-base font-medium text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-pointer line-clamp-1 leading-snug">
          {cleanTitle}
        </h3>
      </div>

      {/* Snippet Description */}
      <div className="text-xs sm:text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">
        {cleanDescription}
      </div>
    </div>
  );
}
