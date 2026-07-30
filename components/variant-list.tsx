"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addVariant, deleteVariant, updateVariant } from "@/app/(dashboard)/products/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Variant } from "@/types/product";

function VariantRow({
  variant,
  disabled,
  onSave,
  onDelete,
}: {
  variant: Variant;
  disabled: boolean;
  onSave: (input: { optionName: string; price: string; inventory: string }) => void;
  onDelete: () => void;
}) {
  const [optionName, setOptionName] = useState(variant.optionName);
  const [price, setPrice] = useState(variant.price);
  const [inventory, setInventory] = useState(String(variant.inventory));

  const dirty =
    optionName !== variant.optionName || price !== variant.price || inventory !== String(variant.inventory);

  return (
    <TableRow>
      <TableCell>
        <Input
          value={optionName}
          onChange={(event) => setOptionName(event.target.value)}
          disabled={disabled}
          aria-label="Option name"
        />
      </TableCell>
      <TableCell>
        <Input
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          inputMode="decimal"
          className="font-mono"
          disabled={disabled}
          aria-label="Price"
        />
      </TableCell>
      <TableCell>
        <Input
          value={inventory}
          onChange={(event) => setInventory(event.target.value)}
          inputMode="numeric"
          className="font-mono"
          disabled={disabled}
          aria-label="Inventory"
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {dirty && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onSave({ optionName, price, inventory })}
            >
              Save
            </Button>
          )}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={disabled}
            aria-label={`Delete ${variant.optionName}`}
            onClick={onDelete}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// Unit 11: variant add/edit/remove, a child of the product draft. Each row
// is independently, inline-editable — no separate "edit mode" toggle — and
// mutations go straight to the server via useTransition rather than a
// <form>, since this list already lives inside the product editor's own
// <form> (components/product-form.tsx) and a nested <form> per row isn't
// valid HTML — same reasoning as components/remove-store-dialog.tsx's
// disconnectStore call. Only ever rendered in mode="edit" (a variant needs
// an existing product to belong to).
export function VariantList({ productId, variants }: { productId: string; variants: Variant[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newOptionName, setNewOptionName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newInventory, setNewInventory] = useState("");

  function handleSave(variantId: string, input: { optionName: string; price: string; inventory: string }) {
    startTransition(async () => {
      const result = await updateVariant(variantId, {
        optionName: input.optionName,
        price: input.price,
        inventory: Number(input.inventory),
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Variant saved");
      router.refresh();
    });
  }

  function handleDelete(variantId: string) {
    startTransition(async () => {
      const result = await deleteVariant(variantId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Variant removed");
      router.refresh();
    });
  }

  function handleAdd() {
    startTransition(async () => {
      const result = await addVariant(productId, {
        optionName: newOptionName,
        price: newPrice,
        inventory: Number(newInventory || 0),
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setNewOptionName("");
      setNewPrice("");
      setNewInventory("");
      toast.success("Variant added");
      router.refresh();
    });
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
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.map((variant) => (
            <VariantRow
              key={variant.id}
              variant={variant}
              disabled={isPending}
              onSave={(input) => handleSave(variant.id, input)}
              onDelete={() => handleDelete(variant.id)}
            />
          ))}
          <TableRow>
            <TableCell>
              <Input
                placeholder="e.g. Small / Blue"
                value={newOptionName}
                onChange={(event) => setNewOptionName(event.target.value)}
                disabled={isPending}
                aria-label="New option name"
              />
            </TableCell>
            <TableCell>
              <Input
                placeholder="0.00"
                value={newPrice}
                onChange={(event) => setNewPrice(event.target.value)}
                inputMode="decimal"
                className="font-mono"
                disabled={isPending}
                aria-label="New variant price"
              />
            </TableCell>
            <TableCell>
              <Input
                placeholder="0"
                value={newInventory}
                onChange={(event) => setNewInventory(event.target.value)}
                inputMode="numeric"
                className="font-mono"
                disabled={isPending}
                aria-label="New variant inventory"
              />
            </TableCell>
            <TableCell className="text-right">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending || !newOptionName.trim() || !newPrice.trim()}
                onClick={handleAdd}
              >
                <Plus className="size-4" />
                Add
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
