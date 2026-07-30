"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
};

function makeTempId(): string {
  return `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Unit 11 follow-up, per explicit user request: add/edit/remove is purely
// local/staged state, not an immediate per-row server call — nothing about
// a variant persists to the database until the product editor's own Save
// button is pressed (components/product-form.tsx serializes this array into
// a hidden input on submit). Fully controlled by the parent so the preview
// panel can mirror the same in-progress list.
export function VariantList({
  variants,
  onChange,
}: {
  variants: DraftVariant[];
  onChange: (variants: DraftVariant[]) => void;
}) {
  function updateRow(id: string, patch: Partial<DraftVariant>) {
    onChange(variants.map((variant) => (variant.id === id ? { ...variant, ...patch } : variant)));
  }

  function removeRow(id: string) {
    onChange(variants.filter((variant) => variant.id !== id));
  }

  function addRow() {
    onChange([...variants, { id: makeTempId(), optionName: "", price: "", inventory: "0" }]);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Variants</Label>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Option</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Inventory</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                No variants yet.
              </TableCell>
            </TableRow>
          )}
          {variants.map((variant) => (
            <TableRow key={variant.id}>
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
                  value={variant.inventory}
                  onChange={(event) => updateRow(variant.id, { inventory: event.target.value })}
                  inputMode="numeric"
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
