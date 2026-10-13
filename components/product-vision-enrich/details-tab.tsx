"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EnrichedProductFields } from "@/lib/validation/ai-vision-enrichment";
import type { Collection } from "@/types/collection";
import { FolderCheck, Sparkles } from "lucide-react";

export function formatTaxonomyBreadcrumb(breadcrumb: string | null | undefined): string {
  if (!breadcrumb || !breadcrumb.trim()) return "No taxonomy matched";
  return breadcrumb.trim();
}

const NO_COLLECTION_VALUE = "none";

interface DetailsTabProps {
  fields: EnrichedProductFields;
  collections?: Collection[];
  onChange: (updater: (prev: EnrichedProductFields) => EnrichedProductFields) => void;
}

export function DetailsTab({ fields, collections = [], onChange }: DetailsTabProps) {
  const selectedCollectionTitle =
    fields.collectionTitle ||
    (fields.collectionId
      ? collections.find((c) => c.id === fields.collectionId)?.title
      : null);

  return (
    <div className="space-y-4 pt-3">
      {/* Optimized Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="ai-title" className="text-xs">Optimized Catalog Title</Label>
          <span className="text-[11px] text-muted-foreground font-mono">
            {fields.title.length} chars
          </span>
        </div>
        <Input
          id="ai-title"
          value={fields.title}
          onChange={(e) =>
            onChange((prev) => ({ ...prev, title: e.target.value }))
          }
          className="font-medium"
        />
      </div>

      {/* Shopify Collection */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1.5">
            <FolderCheck className="size-3.5 text-primary" />
            <span>Shopify Collection</span>
          </Label>
          {fields.collectionId && (
            <Badge variant="outline" className="text-[10px] text-primary border-primary/40 gap-1 bg-primary/5">
              <Sparkles className="size-2.5" />
              AI Suggested
            </Badge>
          )}
        </div>
        {collections.length > 0 ? (
          <Select
            value={fields.collectionId || NO_COLLECTION_VALUE}
            onValueChange={(val) => {
              if (!val || val === NO_COLLECTION_VALUE) {
                onChange((prev) => ({
                  ...prev,
                  collectionId: null,
                  collectionTitle: null,
                }));
              } else {
                const matched = collections.find((c) => c.id === val);
                onChange((prev) => ({
                  ...prev,
                  collectionId: val,
                  collectionTitle: matched?.title ?? null,
                }));
              }
            }}
          >
            <SelectTrigger className="w-full text-xs">
              <SelectValue>
                {selectedCollectionTitle || "No collection (Unassigned)"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_COLLECTION_VALUE}>
                No collection (Unassigned)
              </SelectItem>
              {collections.map((col) => (
                <SelectItem key={col.id} value={col.id} className="text-xs">
                  {col.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs text-muted-foreground">
            {selectedCollectionTitle ? (
              <span className="font-medium text-foreground">{selectedCollectionTitle}</span>
            ) : (
              <span>No collections exist in this store</span>
            )}
          </div>
        )}
      </div>

      {/* Shopify Taxonomy Category */}
      <div className="space-y-1.5">
        <Label className="text-xs">Shopify Product Taxonomy Category</Label>
        <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs">
          <div className="font-medium text-foreground">
            {formatTaxonomyBreadcrumb(fields.categoryFullName)}
          </div>
          {fields.categoryId && (
            <span className="font-mono text-[10px] text-muted-foreground">
              ID: {fields.categoryId}
            </span>
          )}
        </div>
      </div>

      {/* Product Tags */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="ai-tags" className="text-xs">Product Tags (comma separated)</Label>
          <span className="text-[11px] text-muted-foreground font-mono">
            {fields.tags.length} tags
          </span>
        </div>
        <Input
          id="ai-tags"
          value={fields.tags.join(", ")}
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            }))
          }
        />
        <div className="flex flex-wrap gap-1 pt-1">
          {fields.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              #{tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
