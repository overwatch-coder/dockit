"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { toast } from "sonner";
import { createProduct, updateProduct } from "@/app/(dashboard)/products/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VariantList, type DraftVariant } from "@/components/variant-list";
import { sanitizeDescriptionHtml } from "@/lib/sanitize-description";
import type { Product, ProductStatus } from "@/types/product";

function PreviewStatusBadge({ status }: { status: ProductStatus }) {
  if (status === "ACTIVE") {
    return <Badge className="border-transparent bg-success/10 text-success">Active</Badge>;
  }
  return <Badge className="border-transparent bg-warning/10 text-warning">Draft</Badge>;
}

function toDraftVariants(product: Product | undefined): DraftVariant[] {
  return (
    product?.variants.map((variant) => ({
      id: variant.id,
      optionName: variant.optionName,
      price: variant.price,
      inventory: String(variant.inventory),
    })) ?? []
  );
}

// Shared by /products/new (mode="create") and /products/[id] (mode="edit")
// so there's one form implementation, not two. storeId is only needed for
// create (a new product has no product/store of its own to bind yet).
//
// Fields are lifted into controlled state (not just uncontrolled
// defaultValue inputs) so the preview panel on the right can mirror what's
// being typed live, side by side with the editing fields on the left,
// per explicit user request — rather than only seeing the raw edit form.
export function ProductForm({
  mode,
  product,
  storeId,
}: {
  mode: "create" | "edit";
  product?: Product;
  storeId?: string;
}) {
  const action =
    mode === "create" ? createProduct.bind(null, storeId!) : updateProduct.bind(null, product!.id);
  const [state, formAction, isPending] = useActionState(action, undefined);

  const [title, setTitle] = useState(product?.title ?? "");
  const [price, setPrice] = useState(product?.price ?? "");
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "DRAFT");
  const [descriptionHtml, setDescriptionHtml] = useState(product?.description ?? "");
  const [variants, setVariants] = useState<DraftVariant[]>(() => toDraftVariants(product));

  // Shopify products can have more than one image (Unit 12 will add
  // uploading new ones; this only displays what's already imported). Falls
  // back to the single featured imageUrl for products imported before this
  // field existed. Clicking a thumbnail just changes which one shows as the
  // main preview image — a display-only selection, not saved anywhere.
  const gallery = product?.imageUrls?.length ? product.imageUrls : product?.imageUrl ? [product.imageUrl] : [];
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const mainImage = gallery[selectedImageIndex] ?? null;

  const prevStateRef = useRef(state);
  useEffect(() => {
    if (state === prevStateRef.current) return;
    prevStateRef.current = state;
    if (state && "success" in state && state.success) {
      toast.success("Saved");
    } else if (state && "error" in state && state.error) {
      toast.error(state.error);
    }
  }, [state]);

  const fieldErrors = state && "fieldErrors" in state ? state.fieldErrors : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <form action={formAction} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            {fieldErrors?.title && <p className="text-sm text-destructive">{fieldErrors.title}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <RichTextEditor
              name="description"
              defaultValue={product?.description ?? ""}
              onChange={setDescriptionHtml}
            />
            {fieldErrors?.description && (
              <p className="text-sm text-destructive">{fieldErrors.description}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="price">Price</Label>
            <Input
              id="price"
              name="price"
              inputMode="decimal"
              className="max-w-40 font-mono"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
            {fieldErrors?.price && <p className="text-sm text-destructive">{fieldErrors.price}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="status">Status</Label>
            <Select name="status" value={status} onValueChange={(value) => setStatus(value as ProductStatus)}>
              <SelectTrigger id="status" className="max-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors?.status && <p className="text-sm text-destructive">{fieldErrors.status}</p>}
          </div>

          {mode === "edit" && product && (
            <>
              <VariantList variants={variants} onChange={setVariants} />
              <input type="hidden" name="variants" value={JSON.stringify(variants)} />
            </>
          )}

          {/* Sticky so Save/Cancel stay reachable while the form (description,
              variants) grows long, per explicit user request — a fixed bar
              rather than only living at the bottom of a potentially tall
              scrolling form. */}
          <div className="sticky bottom-0 z-10 flex gap-2 border-t border-border bg-background py-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="ghost" nativeButton={false} render={<Link href="/products" />}>
              Cancel
            </Button>
          </div>
        </form>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-label font-medium text-muted-foreground">Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                {mainImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Shopify CDN host isn't guaranteed constant across every store, so this isn't allowlisted through next/image.
                  <img
                    src={mainImage}
                    alt={title || "Product image"}
                    className="h-40 w-full rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center rounded-lg border border-border bg-muted">
                    <ImageOff className="size-8 text-muted-foreground" />
                  </div>
                )}
                {gallery.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {gallery.map((url, index) => (
                      <button
                        key={url + index}
                        type="button"
                        onClick={() => setSelectedImageIndex(index)}
                        className={`size-12 shrink-0 overflow-hidden rounded-md border object-cover ${
                          index === selectedImageIndex ? "border-primary ring-2 ring-primary" : "border-border"
                        }`}
                        aria-label={`Show image ${index + 1}`}
                        aria-pressed={index === selectedImageIndex}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- same rationale as the main preview image above. */}
                        <img src={url} alt="" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-page-title font-semibold text-foreground">
                  {title || "Untitled product"}
                </h2>
                <PreviewStatusBadge status={status} />
              </div>
              <span className="font-mono text-table-data text-foreground">{price || "0.00"}</span>
              {descriptionHtml ? (
                <div
                  className="text-sm text-foreground [&_a]:text-primary [&_a]:underline [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: sanitizeDescriptionHtml(descriptionHtml) }}
                />
              ) : (
                <span className="text-sm text-muted-foreground">No description</span>
              )}

              {variants.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-label font-medium text-muted-foreground">Variants</span>
                  <ul className="flex flex-col gap-1">
                    {variants.map((variant) => (
                      <li key={variant.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-foreground">
                          {variant.optionName || "Untitled variant"}
                        </span>
                        <span className="shrink-0 font-mono text-table-data text-muted-foreground">
                          {variant.price || "0.00"} · {variant.inventory || "0"} in stock
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
