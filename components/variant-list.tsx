"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff, Plus, Trash2 } from "lucide-react";
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
  // Unit 25: one of the product's own gallery images (passed in as
  // `images` below), or null for no variant-specific image.
  imageUrl: string | null;
};

function makeTempId(): string {
  return `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Unit 25: a small per-row picker limited to the product's own already-
// persisted gallery. A just-dropped, not-yet-uploaded image
// (components/product-images.tsx's pendingImages) has no durable URL yet —
// it's a local blob: object URL, meaningless once the tab closes — so it
// isn't offered here; the owner links it after the next Save uploads it.
function VariantImagePicker({
  images,
  value,
  onChange,
}: {
  images: string[];
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="relative size-10 shrink-0 overflow-hidden rounded-md border border-input"
            aria-label={value ? "Change variant image" : "Set variant image"}
          />
        }
      >
        {value ? (
          <Image src={value} alt="" fill sizes="40px" className="object-cover" />
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
                value === null ? "border-primary ring-2 ring-primary" : "border-border"
              }`}
              aria-label="No image"
              aria-pressed={value === null}
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
                  value === url ? "border-primary ring-2 ring-primary" : "border-border"
                }`}
                aria-label="Use this image"
                aria-pressed={value === url}
                onClick={() => {
                  onChange(url);
                  setOpen(false);
                }}
              >
                <Image src={url} alt="" fill sizes="40px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Unit 11 follow-up, per explicit user request: add/edit/remove is purely
// local/staged state, not an immediate per-row server call — nothing about
// a variant persists to the database until the product editor's own Save
// button is pressed (components/product-form.tsx serializes this array into
// a hidden input on submit). Fully controlled by the parent so the preview
// panel can mirror the same in-progress list.
export function VariantList({
  variants,
  images,
  onChange,
}: {
  variants: DraftVariant[];
  // Unit 25: the product's own current gallery (components/product-form.tsx's
  // `gallery`) — the pool of images each row's picker can choose from.
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
    onChange([...variants, { id: makeTempId(), optionName: "", price: "", inventory: "0", imageUrl: null }]);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Variants</Label>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Image</TableHead>
            <TableHead>Option</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Inventory</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                No variants yet.
              </TableCell>
            </TableRow>
          )}
          {variants.map((variant) => (
            <TableRow key={variant.id}>
              <TableCell>
                <VariantImagePicker
                  images={images}
                  value={variant.imageUrl}
                  onChange={(imageUrl) => updateRow(variant.id, { imageUrl })}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={variant.optionName}
                  onChange={(event) => updateRow(variant.id, { optionName: event.target.value })}
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
