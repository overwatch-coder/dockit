"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImageOff, Palette, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { productThumbnailUrl } from "@/lib/shopify/image-url";
import { detectColorFromName, isValidHexColor, PRESET_SWATCHES } from "@/lib/utils/color-detect";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// A row's id is either a real Variant.id (existing, already-persisted row)
// or a client-generated temporary id for a row added since the page
// loaded — lib/db/variants.ts's syncProductVariants tells them apart by
// checking against the product's actual current variant ids in the
// database, not by inspecting this id's format.
export type DraftVariant = {
  id: string;
  optionName: string;
  price: string;
  inventory: string;
  // One of the product's own gallery images (passed in as `images` below),
  // or null for no variant-specific image.
  imageUrl: string | null;
  // Color swatch hex code (e.g. #000000) for Shopify variant color swatches
  colorHex?: string | null;
};

function makeTempId(): string {
  return `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// A per-row picker limited to the product's own already-persisted gallery.
function VariantImagePicker({
  images,
  value,
  fallbackImage,
  onChange,
}: {
  images: string[];
  value: string | null;
  fallbackImage?: string | null;
  onChange: (url: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const effectiveImage = value || fallbackImage || null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="relative size-10 shrink-0 overflow-hidden rounded-md border border-input cursor-pointer hover:border-primary/50 transition-colors"
            aria-label={effectiveImage ? "Change variant image" : "Set variant image"}
          />
        }
      >
        {effectiveImage ? (
          <Image src={productThumbnailUrl(effectiveImage, 80)} alt="" fill sizes="40px" className="object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center bg-muted">
            <ImageOff className="size-4 text-muted-foreground" />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56">
        {images.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No saved images yet — save the product after adding images to link one to this variant.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`relative flex size-10 shrink-0 items-center justify-center rounded-md border p-0 ${
                effectiveImage === null ? "border-primary ring-2 ring-primary" : "border-border"
              }`}
              aria-label="No image"
              aria-pressed={effectiveImage === null}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <ImageOff className="size-4 text-muted-foreground" />
            </button>
            {images.map((url) => (
              <button
                key={url}
                type="button"
                className={`relative size-10 shrink-0 overflow-hidden rounded-md border p-0 ${
                  effectiveImage === url ? "border-primary ring-2 ring-primary" : "border-border"
                }`}
                aria-label="Use this image"
                aria-pressed={effectiveImage === url}
                onClick={() => {
                  onChange(url);
                  setOpen(false);
                }}
              >
                <Image src={productThumbnailUrl(url, 80)} alt="" fill sizes="40px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Swatch popover allowing merchants to pick a color preset, custom hex, or native picker.
function VariantColorPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (hex: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customHex, setCustomHex] = useState(value || "#000000");

  useEffect(() => {
    if (value) setCustomHex(value);
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="group relative flex size-10 shrink-0 items-center justify-center rounded-md border border-input cursor-pointer hover:border-primary/50 transition-colors"
            aria-label={value ? `Variant color ${value}` : "Set variant color swatch"}
          />
        }
      >
        {value ? (
          <span
            className="size-6 rounded-full border border-black/15 shadow-xs transition-transform group-hover:scale-110"
            style={{ backgroundColor: value }}
          />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground group-hover:border-primary/60 group-hover:text-primary transition-colors">
            <Palette className="size-3.5" />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Color Swatch</span>
            {value && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick presets */}
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_SWATCHES.map((swatch) => (
              <button
                key={swatch.hex}
                type="button"
                title={`${swatch.name} (${swatch.hex})`}
                aria-label={`Select ${swatch.name}`}
                className={cn(
                  "size-7 rounded-full border border-black/10 transition-transform hover:scale-115 cursor-pointer",
                  value?.toUpperCase() === swatch.hex.toUpperCase() && "ring-2 ring-primary ring-offset-1"
                )}
                style={{ backgroundColor: swatch.hex }}
                onClick={() => {
                  onChange(swatch.hex);
                  setCustomHex(swatch.hex);
                  setOpen(false);
                }}
              />
            ))}
          </div>

          {/* Custom Hex input with HTML color picker */}
          <div className="flex items-center gap-2 border-t pt-2">
            <input
              type="color"
              value={isValidHexColor(customHex) ? customHex : "#000000"}
              onChange={(e) => {
                const hex = e.target.value.toUpperCase();
                setCustomHex(hex);
                onChange(hex);
              }}
              className="size-8 cursor-pointer rounded border border-input p-0.5"
              aria-label="Pick custom color"
            />
            <Input
              value={customHex}
              onChange={(e) => {
                const hex = e.target.value;
                setCustomHex(hex);
                if (isValidHexColor(hex)) {
                  onChange(hex.toUpperCase());
                }
              }}
              placeholder="#HEX"
              className="h-8 font-mono text-xs uppercase"
              aria-label="Custom hex code"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Add/edit/remove is staged client-side and only persists when the product
// editor's Save button is pressed. Fully controlled by the parent component.
export function VariantList({
  variants,
  images,
  onChange,
}: {
  variants: DraftVariant[];
  // The product's own current gallery — the pool of images each row's picker can choose from.
  images: string[];
  onChange: (variants: DraftVariant[]) => void;
}) {
  function updateRow(id: string, patch: Partial<DraftVariant>) {
    onChange(variants.map((variant) => (variant.id === id ? { ...variant, ...patch } : variant)));
  }

  function removeRow(id: string) {
    onChange(variants.filter((variant) => variant.id !== id));
  }

  function addRow() {
    const isFirst = variants.length === 0;
    onChange([
      ...variants,
      {
        id: makeTempId(),
        optionName: "",
        price: "",
        inventory: "0",
        imageUrl: isFirst && images.length > 0 ? images[0] : null,
        colorHex: null,
      },
    ]);
  }

  function autoDetectAllSwatches() {
    let count = 0;
    const next = variants.map((v) => {
      if (!v.colorHex) {
        const detected = detectColorFromName(v.optionName);
        if (detected) {
          count++;
          return { ...v, colorHex: detected };
        }
      }
      return v;
    });

    if (count > 0) {
      onChange(next);
      toast.success(`Detected ${count} color swatch${count > 1 ? "es" : ""} from variant titles.`);
    } else {
      toast.info("No new color names detected in variant titles.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Variants</Label>
        {variants.length > 0 && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
            onClick={autoDetectAllSwatches}
            title="Auto-detect color swatches from variant names"
          >
            <Sparkles className="size-3 text-primary" />
            Auto-Detect Swatches
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Image</TableHead>
            <TableHead className="w-14">Swatch</TableHead>
            <TableHead>Option</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Inventory</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                No variants yet.
              </TableCell>
            </TableRow>
          )}
          {variants.map((variant, index) => (
            <TableRow key={variant.id}>
              <TableCell>
                <VariantImagePicker
                  images={images}
                  value={variant.imageUrl}
                  fallbackImage={index === 0 && images.length > 0 ? images[0] : null}
                  onChange={(imageUrl) => updateRow(variant.id, { imageUrl })}
                />
              </TableCell>
              <TableCell>
                <VariantColorPicker
                  value={variant.colorHex}
                  onChange={(colorHex) => updateRow(variant.id, { colorHex })}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={variant.optionName}
                  onChange={(event) => {
                    const optionName = event.target.value;
                    const updates: Partial<DraftVariant> = { optionName };
                    if (!variant.colorHex) {
                      const detected = detectColorFromName(optionName);
                      if (detected) updates.colorHex = detected;
                    }
                    updateRow(variant.id, updates);
                  }}
                  aria-label="Option name"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={variant.price}
                  onChange={(event) => updateRow(variant.id, { price: event.target.value })}
                  inputMode="decimal"
                  className="font-mono"
                  aria-label="Price"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={variant.inventory}
                  onChange={(event) => updateRow(variant.id, { inventory: event.target.value })}
                  inputMode="numeric"
                  min="0"
                  step="1"
                  required
                  className="font-mono"
                  aria-label="Inventory"
                />
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${variant.optionName || "variant"}`}
                  onClick={() => removeRow(variant.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button type="button" size="sm" variant="outline" className="self-start" onClick={addRow}>
        <Plus className="size-4" />
        Add variant
      </Button>
    </div>
  );
}
