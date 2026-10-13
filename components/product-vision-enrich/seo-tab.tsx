"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EnrichedProductFields } from "@/lib/validation/ai-vision-enrichment";

interface SeoTabProps {
  fields: EnrichedProductFields;
  onChange: (updater: (prev: EnrichedProductFields) => EnrichedProductFields) => void;
}

export function SeoTab({ fields, onChange }: SeoTabProps) {
  return (
    <div className="space-y-4 pt-3">
      {/* Live SERP Snippet Preview */}
      <div className="rounded-xl border border-border/60 bg-muted/10 p-3.5 space-y-1">
        <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
          Search Engine Result Snippet Preview
        </span>
        <div className="text-sm font-semibold text-primary hover:underline cursor-pointer">
          {fields.seoTitle || "Product Title | Dockit Store"}
        </div>
        <div className="text-xs text-muted-foreground line-clamp-2">
          {fields.seoDescription || "Discover this premium product with detailed specifications and fast delivery."}
        </div>
      </div>

      {/* SEO Title Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="ai-seo-title" className="text-xs">SEO Title</Label>
          <span className="text-[11px] font-mono text-muted-foreground">
            {fields.seoTitle.length}/60 chars
          </span>
        </div>
        <Input
          id="ai-seo-title"
          value={fields.seoTitle}
          onChange={(e) =>
            onChange((prev) => ({ ...prev, seoTitle: e.target.value }))
          }
        />
      </div>

      {/* SEO Meta Description Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="ai-seo-desc" className="text-xs">SEO Meta Description</Label>
          <span className="text-[11px] font-mono text-muted-foreground">
            {fields.seoDescription.length}/155 chars
          </span>
        </div>
        <Input
          id="ai-seo-desc"
          value={fields.seoDescription}
          onChange={(e) =>
            onChange((prev) => ({ ...prev, seoDescription: e.target.value }))
          }
        />
      </div>
    </div>
  );
}
