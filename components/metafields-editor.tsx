"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, Plus, X, Check, Loader2 } from "lucide-react";
import {
  fetchCategoryAttributesAction,
  fetchProductMetafieldDefinitionsAction,
} from "@/app/(dashboard)/products/actions";
import { Button } from "@/components/ui/button";
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
import type {
  CategoryAttributeDefinition,
  ProductMetafieldDefinition,
} from "@/lib/shopify/metafields";
import type { MetafieldValueEntry } from "@/types/product";
import { cn } from "@/lib/utils";

export interface MetafieldsEditorProps {
  storeId: string;
  categoryId?: string | null;
  categoryFullName?: string | null;
  value: MetafieldValueEntry[];
  onChange: (metafields: MetafieldValueEntry[]) => void;
  aiSuggestedMetafields?: MetafieldValueEntry[];
  disabled?: boolean;
}

export function MetafieldsEditor({
  storeId,
  categoryId,
  categoryFullName,
  value = [],
  onChange,
  aiSuggestedMetafields = [],
  disabled = false,
}: MetafieldsEditorProps) {
  const [categoryAttrs, setCategoryAttrs] = useState<CategoryAttributeDefinition[]>([]);
  const [productDefs, setProductDefs] = useState<ProductMetafieldDefinition[]>([]);
  const [activeCategoryAttrIds, setActiveCategoryAttrIds] = useState<Set<string>>(new Set());
  const [activeProductDefIds, setActiveProductDefIds] = useState<Set<string>>(new Set());
  const [isLoadingAttrs, setIsLoadingAttrs] = useState(false);
  const [isLoadingDefs, setIsLoadingDefs] = useState(false);

  // Fetch category attributes whenever categoryId changes
  useEffect(() => {
    let mounted = true;
    if (!storeId || !categoryId) {
      setCategoryAttrs([]);
      setActiveCategoryAttrIds(new Set());
      return;
    }

    setIsLoadingAttrs(true);
    fetchCategoryAttributesAction(storeId, categoryId)
      .then((res) => {
        if (!mounted) return;
        if (res.success) {
          setCategoryAttrs(res.data);
          // By default, activate the first 3 attributes or those that have values/suggestions
          const initialActive = new Set<string>();
          res.data.slice(0, 3).forEach((a) => initialActive.add(a.id));
          res.data.forEach((a) => {
            const hasVal = value.some(
              (v) => (v.key === (a.handle || a.name) || v.name === a.name) && v.value
            );
            const hasAi = aiSuggestedMetafields.some(
              (s) => (s.key === (a.handle || a.name) || s.name === a.name) && s.value
            );
            if (hasVal || hasAi) initialActive.add(a.id);
          });
          setActiveCategoryAttrIds(initialActive);
        } else {
          setCategoryAttrs([]);
        }
      })
      .catch(() => {
        if (mounted) setCategoryAttrs([]);
      })
      .finally(() => {
        if (mounted) setIsLoadingAttrs(false);
      });

    return () => {
      mounted = false;
    };
  }, [storeId, categoryId]);

  // Fetch store product metafield definitions once
  useEffect(() => {
    let mounted = true;
    if (!storeId) return;

    setIsLoadingDefs(true);
    fetchProductMetafieldDefinitionsAction(storeId)
      .then((res) => {
        if (!mounted) return;
        if (res.success) {
          setProductDefs(res.data);
          const initialActive = new Set<string>();
          res.data.slice(0, 3).forEach((d) => initialActive.add(d.id));
          res.data.forEach((d) => {
            const hasVal = value.some(
              (v) => v.namespace === d.namespace && v.key === d.key && v.value
            );
            const hasAi = aiSuggestedMetafields.some(
              (s) => s.namespace === d.namespace && s.key === d.key && s.value
            );
            if (hasVal || hasAi) initialActive.add(d.id);
          });
          setActiveProductDefIds(initialActive);
        }
      })
      .catch(() => {
        if (mounted) setProductDefs([]);
      })
      .finally(() => {
        if (mounted) setIsLoadingDefs(false);
      });

    return () => {
      mounted = false;
    };
  }, [storeId]);

  function getCategoryAttrValue(attr: CategoryAttributeDefinition): string {
    const key = attr.handle || attr.name;
    const match = value.find(
      (v) => (v.key === key || v.name === attr.name) && (v.isCategoryMetafield || v.namespace === "shopify")
    );
    return match?.value ?? "";
  }

  function getProductDefValue(def: ProductMetafieldDefinition): string {
    const match = value.find((v) => v.namespace === def.namespace && v.key === def.key);
    return match?.value ?? "";
  }

  function getCategoryAttrSuggestion(attr: CategoryAttributeDefinition): string {
    const key = attr.handle || attr.name;
    const match = aiSuggestedMetafields.find(
      (s) => (s.key === key || s.name === attr.name) && (s.isCategoryMetafield || s.namespace === "shopify")
    );
    return match?.value ?? "";
  }

  function getProductDefSuggestion(def: ProductMetafieldDefinition): string {
    const match = aiSuggestedMetafields.find(
      (s) => s.namespace === def.namespace && s.key === def.key
    );
    return match?.value ?? "";
  }

  function handleSetCategoryAttrValue(attr: CategoryAttributeDefinition, val: string) {
    const key = attr.handle || attr.name;
    const next = value.filter(
      (v) => !(v.key === key || v.name === attr.name)
    );
    if (val.trim()) {
      next.push({
        namespace: "shopify",
        key,
        name: attr.name,
        value: val.trim(),
        type: attr.type === "choice" ? "single_line_text_field" : undefined,
        isCategoryMetafield: true,
      });
    }
    onChange(next);
  }

  function handleSetProductDefValue(def: ProductMetafieldDefinition, val: string) {
    const next = value.filter(
      (v) => !(v.namespace === def.namespace && v.key === def.key)
    );
    if (val.trim()) {
      next.push({
        namespace: def.namespace,
        key: def.key,
        name: def.name,
        value: val.trim(),
        type: def.typeName,
        isCategoryMetafield: false,
      });
    }
    onChange(next);
  }

  return (
    <div className="space-y-6">
      {/* Category Metafields Section */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Label className="text-base font-semibold">Category metafields</Label>
          {categoryFullName && (
            <span className="text-xs text-muted-foreground">{categoryFullName}</span>
          )}
        </div>

        {!categoryId ? (
          <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Select a category above to view and set category metafields (e.g. Color, Construction, Target gender).
          </div>
        ) : isLoadingAttrs ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading category metafields...
          </div>
        ) : categoryAttrs.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            No specific category metafields required for this category.
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
            {/* Active Category Metafield Rows */}
            <div className="space-y-3">
              {categoryAttrs
                .filter((attr) => activeCategoryAttrIds.has(attr.id))
                .map((attr) => {
                  const currentValue = getCategoryAttrValue(attr);
                  const suggestion = getCategoryAttrSuggestion(attr);
                  const isChoice = attr.type === "choice" && attr.choices && attr.choices.length > 0;

                  return (
                    <div
                      key={attr.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-[180px] flex items-center gap-2">
                        <span className="text-sm font-medium">{attr.name}</span>
                        {suggestion && !currentValue && (
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary text-[10px] px-1.5 py-0 flex items-center gap-1 cursor-pointer hover:bg-primary/20"
                            onClick={() => handleSetCategoryAttrValue(attr, suggestion)}
                            title="Click to apply AI suggestion"
                          >
                            <Sparkles className="h-2.5 w-2.5" />
                            {suggestion}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-1 max-w-md">
                        {isChoice ? (
                          <Select
                            disabled={disabled}
                            value={currentValue || "__empty__"}
                            onValueChange={(val) =>
                              handleSetCategoryAttrValue(attr, !val || val === "__empty__" ? "" : val)
                            }
                          >
                            <SelectTrigger className="w-full text-xs h-9">
                              <SelectValue placeholder={`Select ${attr.name.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              <SelectItem value="__empty__">None</SelectItem>
                              {attr.choices?.map((choice) => (
                                <SelectItem key={choice} value={choice} className="text-xs">
                                  {choice}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            disabled={disabled}
                            placeholder={`Enter ${attr.name.toLowerCase()}`}
                            value={currentValue}
                            onChange={(e) => handleSetCategoryAttrValue(attr, e.target.value)}
                            className="text-xs h-9"
                          />
                        )}

                        {currentValue && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={() => handleSetCategoryAttrValue(attr, "")}
                            title="Clear"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Unadded Category Metafields Pill Buttons */}
            {categoryAttrs.some((attr) => !activeCategoryAttrIds.has(attr.id)) && (
              <div className="pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground block mb-2 font-medium">Add more fields:</span>
                <div className="flex flex-wrap gap-1.5">
                  {categoryAttrs
                    .filter((attr) => !activeCategoryAttrIds.has(attr.id))
                    .map((attr) => (
                      <Button
                        key={attr.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        className="h-7 text-xs px-2.5 rounded-full text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setActiveCategoryAttrIds((prev) => new Set([...prev, attr.id]));
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {attr.name}
                      </Button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product Metafields Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Product metafields</Label>
          <span className="text-xs text-muted-foreground">
            {productDefs.length > 0 ? `${productDefs.length} store definitions` : "Custom fields"}
          </span>
        </div>

        {isLoadingDefs ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading product metafields...
          </div>
        ) : productDefs.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            No product metafield definitions found on your Shopify store. You can create definitions in Shopify under Settings → Custom data.
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
            {/* Active Product Metafield Rows */}
            <div className="space-y-3">
              {productDefs
                .filter((def) => activeProductDefIds.has(def.id))
                .map((def) => {
                  const currentValue = getProductDefValue(def);
                  const suggestion = getProductDefSuggestion(def);

                  return (
                    <div
                      key={def.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{def.name}</span>
                          {suggestion && !currentValue && (
                            <Badge
                              variant="secondary"
                              className="bg-primary/10 text-primary text-[10px] px-1.5 py-0 flex items-center gap-1 cursor-pointer hover:bg-primary/20"
                              onClick={() => handleSetProductDefValue(def, suggestion)}
                              title="Click to apply AI suggestion"
                            >
                              <Sparkles className="h-2.5 w-2.5" />
                              {suggestion}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {def.namespace}.{def.key}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-1 max-w-md">
                        <Input
                          disabled={disabled}
                          placeholder={def.description || `Enter ${def.name.toLowerCase()}`}
                          value={currentValue}
                          onChange={(e) => handleSetProductDefValue(def, e.target.value)}
                          className="text-xs h-9"
                        />

                        {currentValue && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={() => handleSetProductDefValue(def, "")}
                            title="Clear"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Unadded Product Metafields Pill Buttons */}
            {productDefs.some((def) => !activeProductDefIds.has(def.id)) && (
              <div className="pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground block mb-2 font-medium">Add more definitions:</span>
                <div className="flex flex-wrap gap-1.5">
                  {productDefs
                    .filter((def) => !activeProductDefIds.has(def.id))
                    .map((def) => (
                      <Button
                        key={def.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        className="h-7 text-xs px-2.5 rounded-full text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setActiveProductDefIds((prev) => new Set([...prev, def.id]));
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {def.name}
                      </Button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
