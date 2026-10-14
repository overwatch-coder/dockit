"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/tag-input";
import { GoogleSerpPreview } from "@/components/google-serp-preview";
import type { Collection } from "@/types/collection";

export type AiSuggestedField = "seoTitle" | "seoDescription" | "tags" | "collection" | "category";

export interface CurrentSeoState {
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  collectionId: string;
  collectionTitle: string;
  categoryId: string;
  categoryFullName: string;
}

export interface SuggestedSeoState {
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  collectionId: string | null;
  categoryId: string | null;
  categoryFullName: string | null;
}

interface AiSeoReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: CurrentSeoState;
  suggested: SuggestedSeoState;
  collections: Collection[];
  onAccept: (
    accepted: CurrentSeoState,
    appliedFields: AiSuggestedField[]
  ) => void;
}

export function AiSeoReviewDialog({
  open,
  onOpenChange,
  current,
  suggested,
  collections,
  onAccept,
}: AiSeoReviewDialogProps) {
  const [selectedFields, setSelectedFields] = useState<Record<AiSuggestedField, boolean>>({
    seoTitle: true,
    seoDescription: true,
    tags: true,
    collection: true,
    category: true,
  });

  const [seoTitle, setSeoTitle] = useState(suggested.seoTitle);
  const [seoDescription, setSeoDescription] = useState(suggested.seoDescription);
  const [tags, setTags] = useState<string[]>(suggested.tags);
  const [collectionId, setCollectionId] = useState<string>(suggested.collectionId ?? "");

  // Adjusting state during render (not in an effect) is the React-endorsed
  // way to reset the edited draft each time the dialog opens with a fresh
  // suggestion, without an extra setState-in-effect — same pattern as
  // components/connect-store-dialog.tsx:
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSeoTitle(suggested.seoTitle);
      setSeoDescription(suggested.seoDescription);
      setTags(suggested.tags);
      setCollectionId(suggested.collectionId ?? "");
      setSelectedFields({
        seoTitle: Boolean(suggested.seoTitle),
        seoDescription: Boolean(suggested.seoDescription),
        tags: Boolean(suggested.tags.length),
        collection: Boolean(suggested.collectionId),
        category: Boolean(suggested.categoryId),
      });
    }
  }

  const suggestedCollectionTitle = collectionId
    ? collections.find((c) => c.id === collectionId)?.title ?? ""
    : "";

  function toggleField(field: AiSuggestedField) {
    setSelectedFields((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  function handleApply() {
    const appliedFields: AiSuggestedField[] = [];
    const finalState: CurrentSeoState = {
      seoTitle: current.seoTitle,
      seoDescription: current.seoDescription,
      tags: current.tags,
      collectionId: current.collectionId,
      collectionTitle: current.collectionTitle,
      categoryId: current.categoryId,
      categoryFullName: current.categoryFullName,
    };

    if (selectedFields.seoTitle) {
      finalState.seoTitle = seoTitle;
      appliedFields.push("seoTitle");
    }
    if (selectedFields.seoDescription) {
      finalState.seoDescription = seoDescription;
      appliedFields.push("seoDescription");
    }
    if (selectedFields.tags) {
      finalState.tags = tags;
      appliedFields.push("tags");
    }
    if (selectedFields.collection) {
      finalState.collectionId = collectionId;
      finalState.collectionTitle = suggestedCollectionTitle;
      appliedFields.push("collection");
    }
    if (selectedFields.category) {
      finalState.categoryId = suggested.categoryId ?? "";
      finalState.categoryFullName = suggested.categoryFullName ?? "";
      appliedFields.push("category");
    }

    onAccept(finalState, appliedFields);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-11/12 max-w-5xl sm:max-w-5xl md:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review SEO & Metadata Suggestions</DialogTitle>
          <DialogDescription>
            Compare current metadata with AI suggestions. Check the fields you wish to update and edit suggestions directly before applying.
          </DialogDescription>
        </DialogHeader>

        {/* Live Google Search Engine Results Page (SERP) Preview */}
        <div className="pt-2">
          <GoogleSerpPreview
            title={selectedFields.seoTitle ? seoTitle : current.seoTitle}
            description={selectedFields.seoDescription ? seoDescription : current.seoDescription}
            siteName={suggestedCollectionTitle || "Dockit Store"}
          />
        </div>

        <div className="flex flex-col gap-6 my-2">
          {/* SEO Title Row */}
          <div className="flex flex-col gap-2 border border-border rounded-lg p-4 bg-surface">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="chk-seoTitle"
                  checked={selectedFields.seoTitle}
                  onCheckedChange={() => toggleField("seoTitle")}
                />
                <Label htmlFor="chk-seoTitle" className="font-semibold cursor-pointer">
                  SEO Title
                </Label>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Current</span>
                <span className="text-sm text-foreground bg-background p-2 rounded border border-border">
                  {current.seoTitle || <span className="italic text-muted-foreground">(Empty)</span>}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-primary font-medium">Suggested (Editable)</span>
                <Input
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  disabled={!selectedFields.seoTitle}
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          {/* SEO Description Row */}
          <div className="flex flex-col gap-2 border border-border rounded-lg p-4 bg-surface">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="chk-seoDescription"
                  checked={selectedFields.seoDescription}
                  onCheckedChange={() => toggleField("seoDescription")}
                />
                <Label htmlFor="chk-seoDescription" className="font-semibold cursor-pointer">
                  SEO Description
                </Label>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Current</span>
                <span className="text-sm text-foreground bg-background p-2 rounded border border-border min-h-16">
                  {current.seoDescription || <span className="italic text-muted-foreground">(Empty)</span>}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-primary font-medium">Suggested (Editable)</span>
                <Textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  disabled={!selectedFields.seoDescription}
                  rows={2}
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          {/* Collection Row */}
          <div className="flex flex-col gap-2 border border-border rounded-lg p-4 bg-surface">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="chk-collection"
                  checked={selectedFields.collection}
                  onCheckedChange={() => toggleField("collection")}
                />
                <Label htmlFor="chk-collection" className="font-semibold cursor-pointer">
                  Collection Assignment
                </Label>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Current</span>
                <span className="text-sm text-foreground bg-background p-2 rounded border border-border">
                  {current.collectionTitle || <span className="italic text-muted-foreground">No collection</span>}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-primary font-medium">Suggested Match</span>
                <span className="text-sm text-foreground bg-primary-subtle/40 p-2 rounded border border-primary/30">
                  {suggestedCollectionTitle || <span className="italic text-muted-foreground">No matching collection</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Category Row — Shopify's separate standardized Product
              Taxonomy, distinct from Collection above. The suggestion is
              already a real taxonomy match (resolved server-side from the
              AI's plain-text guess), so this is a read-only "Suggested
              Match," same as Collection's, not an inline-editable field. */}
          <div className="flex flex-col gap-2 border border-border rounded-lg p-4 bg-surface">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="chk-category"
                  checked={selectedFields.category}
                  onCheckedChange={() => toggleField("category")}
                  disabled={!suggested.categoryId}
                />
                <Label htmlFor="chk-category" className="font-semibold cursor-pointer">
                  Category
                </Label>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Current</span>
                <span className="text-sm text-foreground bg-background p-2 rounded border border-border">
                  {current.categoryFullName || <span className="italic text-muted-foreground">No category</span>}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-primary font-medium">Suggested Match</span>
                <span className="text-sm text-foreground bg-primary-subtle/40 p-2 rounded border border-primary/30">
                  {suggested.categoryFullName || <span className="italic text-muted-foreground">No matching category</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Tags Row */}
          <div className="flex flex-col gap-2 border border-border rounded-lg p-4 bg-surface">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="chk-tags"
                  checked={selectedFields.tags}
                  onCheckedChange={() => toggleField("tags")}
                />
                <Label htmlFor="chk-tags" className="font-semibold cursor-pointer">
                  Product Tags
                </Label>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Current</span>
                <div className="flex flex-wrap gap-1 bg-background p-2 rounded border border-border min-h-10">
                  {current.tags.length > 0 ? (
                    current.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="italic text-muted-foreground text-sm">(No tags)</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-primary font-medium">Suggested (Editable)</span>
                <TagInput
                  tags={tags}
                  onChange={setTags}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Discard
          </Button>
          <Button type="button" onClick={handleApply}>
            Apply Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
