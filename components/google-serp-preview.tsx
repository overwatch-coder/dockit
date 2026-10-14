"use client";

import { useState } from "react";
import Image from "next/image";
import { Globe, Share2, Check, X, Search, Sparkles } from "lucide-react";
import { productThumbnailUrl } from "@/lib/shopify/image-url";
import { Input } from "@/components/ui/input";

export interface GoogleSerpPreviewProps {
  title?: string | null;
  description?: string | null;
  bodyHtml?: string | null;
  handle?: string | null;
  shopDomain?: string | null;
  siteName?: string | null;
  imageUrl?: string | null;
  className?: string;
  showMetrics?: boolean;
  enableKeywordAnalysis?: boolean;
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
  bodyHtml,
  handle,
  shopDomain,
  siteName,
  imageUrl,
  className = "",
  showMetrics = true,
  enableKeywordAnalysis = true,
}: GoogleSerpPreviewProps) {
  const [activeTab, setActiveTab] = useState<"search" | "social">("search");
  const [focusKeyword, setFocusKeyword] = useState("");

  const displaySiteName = siteName?.trim() || "Store";
  const displayDomain = (shopDomain?.trim() || "your-store.myshopify.com")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  const cleanTitle = (title?.trim() || "Product Title").slice(0, 70);
  const cleanDescription =
    stripHtml(description || "").slice(0, 160) ||
    "Discover this product with detailed specifications, verified customer reviews, and fast shipping.";

  const effectiveHandle = handle?.trim() ? slugifyHandle(handle) : slugifyHandle(cleanTitle);

  const titleLength = (title?.trim() || "").length;
  const descLength = stripHtml(description || "").length;

  // Focus keyword analysis
  const kw = focusKeyword.trim().toLowerCase();
  const titleHasKw = kw.length > 0 && (title || "").toLowerCase().includes(kw);
  const metaHasKw = kw.length > 0 && (description || "").toLowerCase().includes(kw);
  const bodyHasKw = kw.length > 0 && stripHtml(bodyHtml || "").toLowerCase().includes(kw);
  const kwScore = [titleHasKw, metaHasKw, bodyHasKw].filter(Boolean).length;

  return (
    <div
      className={`rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 text-left shadow-xs transition-colors space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between text-xs border-b border-border/40 pb-2">
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50">
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
              activeTab === "search"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="size-3 text-primary" />
            <span>Google Search</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("social")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
              activeTab === "social"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Share2 className="size-3 text-primary" />
            <span>Social Share (OG)</span>
          </button>
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

      {activeTab === "search" ? (
        /* Google SERP Card */
        <div className="space-y-2">
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
      ) : (
        /* OpenGraph / Social Share Card */
        <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            {imageUrl ? (
              <Image
                src={productThumbnailUrl(imageUrl, 600)}
                alt={cleanTitle}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 400px"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                Product Image Preview
              </div>
            )}
          </div>
          <div className="p-3 space-y-1 bg-card">
            <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">
              {displayDomain}
            </span>
            <p className="text-xs sm:text-sm font-semibold text-foreground line-clamp-1 leading-snug">
              {cleanTitle}
            </p>
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-normal">
              {cleanDescription}
            </p>
          </div>
        </div>
      )}

      {/* Focus Keyword Live Scoring */}
      {enableKeywordAnalysis && (
        <div className="pt-2 border-t border-border/40 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="size-3 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Target focus keyword (e.g. leather jacket)..."
                value={focusKeyword}
                onChange={(e) => setFocusKeyword(e.target.value)}
                className="h-8 text-xs pl-7 bg-background"
              />
            </div>
            {kw.length > 0 && (
              <span
                className={`text-[10px] font-mono px-2 py-1 rounded-md font-medium shrink-0 ${
                  kwScore === 3
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : kwScore >= 1
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}
              >
                {kwScore === 3 ? "SEO Perfect" : `${kwScore}/3 Placements`}
              </span>
            )}
          </div>

          {kw.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono pt-0.5">
              <div
                className={`flex items-center gap-1 p-1 rounded border ${
                  titleHasKw
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-muted/40 text-muted-foreground border-border/40"
                }`}
              >
                {titleHasKw ? <Check className="size-2.5" /> : <X className="size-2.5" />}
                <span className="truncate">In Title</span>
              </div>
              <div
                className={`flex items-center gap-1 p-1 rounded border ${
                  metaHasKw
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-muted/40 text-muted-foreground border-border/40"
                }`}
              >
                {metaHasKw ? <Check className="size-2.5" /> : <X className="size-2.5" />}
                <span className="truncate">In Meta</span>
              </div>
              <div
                className={`flex items-center gap-1 p-1 rounded border ${
                  bodyHasKw
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-muted/40 text-muted-foreground border-border/40"
                }`}
              >
                {bodyHasKw ? <Check className="size-2.5" /> : <X className="size-2.5" />}
                <span className="truncate">In Body</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
