import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EnrichedProductFields } from "@/lib/validation/ai-vision-enrichment";
import type { Collection } from "@/types/collection";
import type {
  CategoryAttributeDefinition,
  ProductMetafieldDefinition,
} from "@/lib/shopify/metafields";
import type { MetafieldValueEntry } from "@/types/product";
import { FolderCheck, Sparkles, Tag, Layers, X, Plus } from "lucide-react";

export function formatTaxonomyBreadcrumb(breadcrumb: string | null | undefined): string {
  if (!breadcrumb || !breadcrumb.trim()) return "No taxonomy matched";
  return breadcrumb.trim();
}

const NO_COLLECTION_VALUE = "none";

interface DetailsTabProps {
  fields: EnrichedProductFields;
  collections?: Collection[];
  availableCategoryAttributes?: CategoryAttributeDefinition[];
  availableProductMetafields?: ProductMetafieldDefinition[];
  onChange: (updater: (prev: EnrichedProductFields) => EnrichedProductFields) => void;
}

export function DetailsTab({
  fields,
  collections = [],
  availableCategoryAttributes = [],
  availableProductMetafields = [],
  onChange,
}: DetailsTabProps) {
  const selectedCollectionTitle =
    fields.collectionTitle ||
    (fields.collectionId
      ? collections.find((c) => c.id === fields.collectionId)?.title
      : null);

  const currentMetafields = fields.metafields || [];

  function handleSetMetafield(
    namespace: string,
    key: string,
    name: string,
    value: string,
    isCategoryMetafield: boolean,
    type?: string
  ) {
    onChange((prev) => {
      const existing = (prev.metafields || []).filter(
        (m) => !(m.key === key && m.namespace === namespace)
      );
      if (value.trim()) {
        existing.push({
          namespace,
          key,
          name,
          value: value.trim(),
          isCategoryMetafield,
          type,
        });
      }
      return { ...prev, metafields: existing };
    });
  }

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

      {/* Category Metafields */}
      {availableCategoryAttributes.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              Category Metafields
            </Label>
            <Badge variant="outline" className="text-[10px] text-primary border-primary/40 gap-1 bg-primary/5">
              <Sparkles className="size-2.5" />
              Taxonomy Attributes
            </Badge>
          </div>
          <div className="space-y-2 pt-1">
            {availableCategoryAttributes.map((attr) => {
              const key = attr.handle || attr.name;
              const matchedEntry = currentMetafields.find(
                (m) => (m.key === key || m.name === attr.name) && (m.isCategoryMetafield || m.namespace === "shopify")
              );
              const val = matchedEntry?.value ?? "";
              const isChoice = attr.type === "choice" && attr.choices && attr.choices.length > 0;

              return (
                <div
                  key={attr.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-border/40 pb-2 last:border-b-0 last:pb-0 text-xs"
                >
                  <div className="min-w-[140px] flex items-center gap-1.5">
                    <span className="font-medium">{attr.name}</span>
                    {val && (
                      <span className="text-[10px] text-primary bg-primary/10 px-1 rounded font-mono">
                        AI
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                    {isChoice ? (
                      <Select
                        value={val || "__empty__"}
                        onValueChange={(selected) =>
                          handleSetMetafield(
                            "shopify",
                            key,
                            attr.name,
                            !selected || selected === "__empty__" ? "" : selected,
                            true,
                            "single_line_text_field"
                          )
                        }
                      >
                        <SelectTrigger className="w-full text-xs h-8">
                          <SelectValue placeholder={`Select ${attr.name.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          <SelectItem value="__empty__">None</SelectItem>
                          {attr.choices?.map((c) => (
                            <SelectItem key={c} value={c} className="text-xs">
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder={`Enter ${attr.name.toLowerCase()}`}
                        value={val}
                        onChange={(e) =>
                          handleSetMetafield(
                            "shopify",
                            key,
                            attr.name,
                            e.target.value,
                            true
                          )
                        }
                        className="text-xs h-8"
                      />
                    )}
                    {val && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() =>
                          handleSetMetafield("shopify", key, attr.name, "", true)
                        }
                        title="Clear"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Product Metafields (Store Custom Data) */}
      {availableProductMetafields.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Tag className="size-3.5 text-primary" />
              Product Metafields (Store Custom Data)
            </Label>
            <span className="text-[10px] text-muted-foreground">
              {availableProductMetafields.length} definitions
            </span>
          </div>
          <div className="space-y-2 pt-1">
            {availableProductMetafields.map((def) => {
              const matchedEntry = currentMetafields.find(
                (m) => m.namespace === def.namespace && m.key === def.key
              );
              const val = matchedEntry?.value ?? "";

              return (
                <div
                  key={def.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-border/40 pb-2 last:border-b-0 last:pb-0 text-xs"
                >
                  <div className="min-w-[140px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{def.name}</span>
                      {val && (
                        <span className="text-[10px] text-primary bg-primary/10 px-1 rounded font-mono">
                          AI
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {def.namespace}.{def.key}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                    <Input
                      placeholder={def.description || `Enter ${def.name.toLowerCase()}`}
                      value={val}
                      onChange={(e) =>
                        handleSetMetafield(
                          def.namespace,
                          def.key,
                          def.name,
                          e.target.value,
                          false,
                          def.typeName
                        )
                      }
                      className="text-xs h-8"
                    />
                    {val && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() =>
                          handleSetMetafield(def.namespace, def.key, def.name, "", false)
                        }
                        title="Clear"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

