import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSerpPreview } from "@/components/google-serp-preview";
import type { EnrichedProductFields } from "@/lib/validation/ai-vision-enrichment";

interface SeoTabProps {
  fields: EnrichedProductFields;
  onChange: (updater: (prev: EnrichedProductFields) => EnrichedProductFields) => void;
}

export function SeoTab({ fields, onChange }: SeoTabProps) {
  return (
    <div className="space-y-4 pt-3">
      {/* Live Google SERP Snippet Preview */}
      <GoogleSerpPreview
        title={fields.seoTitle}
        description={fields.seoDescription}
      />

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
