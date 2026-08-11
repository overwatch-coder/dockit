"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { CategoryPicker } from "@/components/category-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagInput } from "@/components/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { shopifyThumbnailUrl } from "@/lib/shopify/image-url";
import type { BulkAiReviewItem } from "@/types/bulk-ai";
import type { Collection } from "@/types/collection";

const NO_COLLECTION_VALUE = "none";

export function getAcceptedBulkAiSuggestions(
  suggestions: BulkAiReviewItem[],
  includedIds: Set<string>
): BulkAiReviewItem[] {
  return suggestions.filter((item) => includedIds.has(item.productId));
}

export function getBulkReviewImageUrls(input: { imageUrl: string | null; imageUrls: string[] }): string[] {
  return [...new Set([input.imageUrl, ...input.imageUrls].filter((url): url is string => Boolean(url)))].slice(0, 2);
}

export function collectionDisplayName(value: string | null, collections: Collection[]): string {
  if (!value || value === NO_COLLECTION_VALUE) return "No collection";
  return collections.find((collection) => collection.id === value)?.title ?? "No collection";
}

export function BulkAiReviewDialog({
  open,
  onOpenChange,
  storeId,
  collections,
  suggestions,
  isApplying,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  collections: Collection[];
  suggestions: BulkAiReviewItem[];
  isApplying: boolean;
  onApply: (items: BulkAiReviewItem[]) => void;
}) {
  const [drafts, setDrafts] = useState<BulkAiReviewItem[]>(suggestions);
  const [includedIds, setIncludedIds] = useState<Set<string>>(() => new Set(suggestions.map((item) => item.productId)));
  const [previousSuggestions, setPreviousSuggestions] = useState(suggestions);

  if (suggestions !== previousSuggestions) {
    setPreviousSuggestions(suggestions);
    setDrafts(suggestions);
    setIncludedIds(new Set(suggestions.map((item) => item.productId)));
  }

  function updateDraft(productId: string, patch: Partial<BulkAiReviewItem>) {
    setDrafts((current) => current.map((item) => (item.productId === productId ? { ...item, ...patch } : item)));
  }

  function toggleIncluded(productId: string) {
    setIncludedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  const accepted = getAcceptedBulkAiSuggestions(drafts, includedIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-11/12 max-w-5xl overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Review bulk AI suggestions</DialogTitle>
          <DialogDescription>
            Edit every suggestion before accepting it. Nothing is saved until you accept the selected products.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {drafts.map((item) => {
            const included = includedIds.has(item.productId);
            const imageUrls = getBulkReviewImageUrls(item);
            return (
              <section key={item.productId} className="rounded-lg border border-border bg-surface p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={included}
                      onCheckedChange={() => toggleIncluded(item.productId)}
                      aria-label={`Accept suggestions for ${item.title}`}
                    />
                    <h3 className="font-medium text-foreground">{item.title}</h3>
                  </div>
                  <span className="text-label text-muted-foreground">{included ? "Will save" : "Excluded"}</span>
                </div>
                <div className="mb-4 flex items-center gap-2">
                  {imageUrls.length > 0 ? (
                    imageUrls.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element -- supports both Shopify CDN and draft Blob URLs
                      <img
                        key={url}
                        src={shopifyThumbnailUrl(url, 160)}
                        alt={`${item.title} product image`}
                        className="size-20 rounded-md border border-border object-cover"
                        loading="lazy"
                      />
                    ))
                  ) : (
                    <p className="text-label text-muted-foreground">No product images available</p>
                  )}
                  {item.collectionId === null && (
                    <p className="ml-2 text-label text-muted-foreground">AI did not suggest a collection—use the images and selector below to choose one.</p>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label>SEO title</Label>
                    <Input value={item.seoTitle} disabled={!included} onChange={(event) => updateDraft(item.productId, { seoTitle: event.target.value })} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Collection</Label>
                    <Select
                      value={item.collectionId ?? NO_COLLECTION_VALUE}
                      disabled={!included}
                      onValueChange={(value) => {
                        const collection = collections.find((entry) => entry.id === value);
                        updateDraft(item.productId, {
                          collectionId: collection?.id ?? null,
                          collectionTitle: collection?.title ?? null,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue>{(value: string | null) => collectionDisplayName(value, collections)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_COLLECTION_VALUE}>No collection</SelectItem>
                        {collections.map((collection) => <SelectItem key={collection.id} value={collection.id}>{collection.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label>SEO description</Label>
                    <Textarea value={item.seoDescription} disabled={!included} rows={3} onChange={(event) => updateDraft(item.productId, { seoDescription: event.target.value })} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Tags</Label>
                    <TagInput tags={item.tags} onChange={(tags) => updateDraft(item.productId, { tags })} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Shopify product category</Label>
                    <CategoryPicker
                      storeId={storeId}
                      categoryId={item.categoryId ?? ""}
                      categoryFullName={item.categoryFullName ?? ""}
                      onChange={(categoryId, categoryFullName) => updateDraft(item.productId, { categoryId: categoryId || null, categoryFullName: categoryFullName || null })}
                    />
                  </div>
                </div>
              </section>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isApplying} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={isApplying || accepted.length === 0} onClick={() => onApply(accepted)}>
            <Sparkles className="size-4" />
            {isApplying ? "Saving..." : `Accept all (${accepted.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
