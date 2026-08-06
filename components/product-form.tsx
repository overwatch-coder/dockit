"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageOff, Maximize2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  createProduct,
  generateProductDescription,
  pushProduct,
  suggestProductSeo,
  updateProduct,
  uploadProductImage,
} from "@/app/(dashboard)/products/actions";
import { ActionConfirmationModal } from "@/components/action-confirmation-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProductImages, type PendingImage } from "@/components/product-images";
import { ProductImagesErrorBoundary } from "@/components/product-images-error-boundary";
import { ProductImageLightbox } from "@/components/product-image-lightbox";
import { TagInput } from "@/components/tag-input";
import { VariantList, type DraftVariant } from "@/components/variant-list";
import { AiDescriptionReviewDialog } from "@/components/ai-description-review-dialog";
import {
  AiSeoReviewDialog,
  type AiSuggestedField,
  type CurrentSeoState,
  type SuggestedSeoState,
} from "@/components/ai-seo-review-dialog";
import { useJobPolling } from "@/lib/hooks/use-job-polling";
import { sanitizeDescriptionHtml } from "@/lib/sanitize-description";
import { cn } from "@/lib/utils";
import type { Collection } from "@/types/collection";
import type { Product, ProductStatus } from "@/types/product";

const NO_COLLECTION_VALUE = "none";

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
  collections = [],
}: {
  mode: "create" | "edit";
  product?: Product;
  storeId?: string;
  // Unit 13: the store's Shopify collections, fetched server-side by the
  // product editor page (only lib/shopify/ is allowed to call Shopify, and
  // only from server code) — never fetched from inside this client
  // component. Unused in mode="create" (collection/tags are edit-mode only,
  // same as variants/images).
  collections?: Collection[];
}) {
  const router = useRouter();
  const action =
    mode === "create" ? createProduct.bind(null, storeId!) : updateProduct.bind(null, product!.id);
  const [state, formAction, isPending] = useActionState(action, undefined);

  const [title, setTitle] = useState(product?.title ?? "");
  const [price, setPrice] = useState(product?.price ?? "");
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "DRAFT");
  const [descriptionHtml, setDescriptionHtml] = useState(product?.description ?? "");
  const [variants, setVariants] = useState<DraftVariant[]>(() => toDraftVariants(product));
  const [collectionId, setCollectionId] = useState(product?.collectionId ?? "");
  const [collectionTitle, setCollectionTitle] = useState(product?.collectionTitle ?? "");
  const [tags, setTags] = useState<string[]>(product?.tags ?? []);
  const [seoTitle, setSeoTitle] = useState(product?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(product?.seoDescription ?? "");

  // Unit 14: which of the four AI-suggestible fields currently hold an
  // unsaved suggestion (drives the --primary-subtle marking), and the
  // suggest button's own pending state — a separate transition from the
  // form's own Save (isPending above), since suggesting never submits.
  const [aiSuggested, setAiSuggested] = useState<Set<AiSuggestedField>>(new Set());
  const [isSuggesting, startSuggestTransition] = useTransition();

  // Review dialog states for AI description and SEO suggestions
  const [isDescriptionReviewOpen, setIsDescriptionReviewOpen] = useState(false);
  const [pendingDescriptionHtml, setPendingDescriptionHtml] = useState("");

  const [isSeoReviewOpen, setIsSeoReviewOpen] = useState(false);
  const [pendingSeoSuggestion, setPendingSeoSuggestion] = useState<SuggestedSeoState | null>(null);

  // Unit 16: AI generate/improve for the main description. Separate from
  // the seoTitle/seoDescription/tags/collection "Suggest SEO & tags" flow
  // above — that one requires a saved product (it fetches store
  // collections); this one only needs whatever's currently staged in the
  // form, so it also works on /products/new before a product row exists.
  const [isDescriptionAiOpen, setIsDescriptionAiOpen] = useState(false);
  const [descriptionInstructions, setDescriptionInstructions] = useState("");
  const [isGeneratingDescription, startDescriptionTransition] = useTransition();
  const [descriptionExternalContent, setDescriptionExternalContent] = useState<
    { html: string; version: number } | undefined
  >(undefined);
  const hasDescription = descriptionHtml.trim().length > 0;

  function handleGenerateDescription() {
    if (!hasDescription && !descriptionInstructions.trim()) {
      toast.error("Describe what you want the description to say.");
      return;
    }
    startDescriptionTransition(async () => {
      const result = await generateProductDescription({
        title,
        price,
        existingDescriptionHtml: hasDescription ? descriptionHtml : null,
        instructions: descriptionInstructions.trim(),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setPendingDescriptionHtml(result.data.descriptionHtml);
      setIsDescriptionAiOpen(false);
      setDescriptionInstructions("");
      setIsDescriptionReviewOpen(true);
    });
  }

  function handleAcceptDescription(acceptedHtml: string) {
    setDescriptionHtml(acceptedHtml);
    setDescriptionExternalContent((prev) => ({
      html: acceptedHtml,
      version: (prev?.version ?? 0) + 1,
    }));
    toast.success("Description updated — review before saving");
  }

  function clearSuggested(field: AiSuggestedField) {
    setAiSuggested((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  function handleSuggest() {
    if (!product) return;
    startSuggestTransition(async () => {
      const result = await suggestProductSeo(product.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setPendingSeoSuggestion(result.data);
      setIsSeoReviewOpen(true);
    });
  }

  function handleAcceptSeo(
    accepted: CurrentSeoState,
    appliedFields: AiSuggestedField[]
  ) {
    if (appliedFields.includes("seoTitle")) setSeoTitle(accepted.seoTitle);
    if (appliedFields.includes("seoDescription")) setSeoDescription(accepted.seoDescription);
    if (appliedFields.includes("tags")) setTags(accepted.tags);
    if (appliedFields.includes("collection")) {
      setCollectionId(accepted.collectionId);
      setCollectionTitle(accepted.collectionTitle);
    }
    setAiSuggested(new Set(appliedFields));
    toast.success("SEO suggestions applied — review before saving");
  }

  // Unit 15: the push job reads the product from Postgres, not this form's
  // in-memory state — pushing while there are unsaved edits would silently
  // push the last-*saved* version while looking like it pushed what's on
  // screen. isDirty compares the current staged fields against a snapshot
  // taken on mount and re-taken after every successful save, gating the
  // Push button until the owner saves first.
  function currentSnapshot() {
    return JSON.stringify({
      title,
      price,
      status,
      descriptionHtml,
      variants,
      collectionId,
      tags,
      seoTitle,
      seoDescription,
    });
  }
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() => currentSnapshot());
  const isDirty = currentSnapshot() !== lastSavedSnapshot;

  const [pushStatus, setPushStatus] = useState<"idle" | "pushing" | "failed">("idle");

  // Per explicit user request: a toast alone wasn't a strong enough "did
  // this actually work" signal for Save/Publish — a clean success now opens
  // the shared animated-checkmark confirmation (components/action-confirmation-modal.tsx)
  // instead. Failures keep their existing toast treatment unchanged.
  const [confirmation, setConfirmation] = useState<{ title: string; description?: string } | null>(null);

  // Unit 16: the poll-until-settled mechanics live in useJobPolling now
  // (shared with components/product-table.tsx's "Push selected" action) —
  // this component keeps only its own status state and toast copy.
  const { start: startPushPolling } = useJobPolling({
    onSettled: (status, results) => {
      if (status === "SUCCEEDED") {
        setPushStatus("idle");
        setConfirmation({
          title: product?.shopifyProductId ? "Republished to Shopify" : "Published to Shopify",
          description: "Your product is now live on Shopify.",
        });
        router.refresh();
      } else {
        setPushStatus("failed");
        const parsedResults = results as { error?: string } | undefined;
        toast.error(parsedResults?.error ?? "Publish failed");
      }
    },
    onError: (message) => {
      setPushStatus("failed");
      toast.error(message);
    },
  });

  async function handlePush() {
    if (!product) return;
    setPushStatus("pushing");
    const result = await pushProduct(product.id);
    if ("error" in result) {
      setPushStatus("failed");
      toast.error(result.error);
      return;
    }
    startPushPolling(result.jobId);
  }

  // Shopify products can have more than one image, and Unit 12 added
  // uploading draft-state ones too (components/product-images.tsx) — both
  // land in the same imageUrls array. Falls back to the single featured
  // imageUrl for products imported before this field existed. Clicking a
  // thumbnail just changes which one shows as the main preview image — a
  // display-only selection, not saved anywhere.
  const gallery = product?.imageUrls?.length ? product.imageUrls : product?.imageUrl ? [product.imageUrl] : [];
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const mainImage = gallery[selectedImageIndex] ?? null;

  // Unit 16, per explicit user request superseding Unit 12's original
  // "upload immediately on drop" design: a dropped/selected file is only
  // staged locally (a blob: object URL, never touches Vercel Blob) until
  // the owner actually saves — removing a staged image before then costs
  // nothing, since nothing was ever uploaded. Only actually persisted
  // images (product.imageUrls) still remove via an immediate server call.
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isUploadingPending, startImageUploadTransition] = useTransition();

  // Each staged file's previewUrl is a browser-memory blob: URL — revoke
  // whatever's still staged if the owner navigates away without saving, so
  // it doesn't leak for the rest of the tab's lifetime. Tracked via a ref
  // (kept in sync every render) rather than depending on `pendingImages`
  // directly, so this only runs once on unmount, not on every add/remove.
  const pendingImagesRef = useRef(pendingImages);
  useEffect(() => {
    // Writing a ref during render is disallowed by this project's eslint
    // config (react-hooks/refs) — kept in sync here, in an effect that runs
    // after every render, instead.
    pendingImagesRef.current = pendingImages;
  });
  useEffect(() => {
    return () => {
      for (const pending of pendingImagesRef.current) {
        URL.revokeObjectURL(pending.previewUrl);
      }
    };
  }, []);

  function handleFilesAdded(files: File[]) {
    const staged = files.map((file) => ({
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPendingImages((prev) => [...prev, ...staged]);
  }

  function handleRemovePending(id: string) {
    setPendingImages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  // Fired only after a successful Save (see the effect below) — uploads
  // every currently-staged file to Vercel Blob, sequentially (same pattern
  // Unit 16's drag-and-drop follow-up already used for a multi-file drop),
  // then clears the staged list and refreshes so the server-fetched gallery
  // picks up the new Blob URLs.
  function uploadPendingImages(toUpload: PendingImage[]) {
    if (!product || toUpload.length === 0) return;
    startImageUploadTransition(async () => {
      let uploadedCount = 0;
      for (const pending of toUpload) {
        const formData = new FormData();
        formData.append("image", pending.file);
        const result = await uploadProductImage(product.id, formData);
        if (result?.error) {
          toast.error(`${pending.file.name}: ${result.error}`);
          continue;
        }
        uploadedCount += 1;
        URL.revokeObjectURL(pending.previewUrl);
      }
      setPendingImages((prev) => prev.filter((p) => !toUpload.includes(p)));
      if (uploadedCount > 0) {
        toast.success(uploadedCount === 1 ? "Image uploaded" : `${uploadedCount} images uploaded`);
        router.refresh();
      }
    });
  }

  const prevStateRef = useRef(state);
  useEffect(() => {
    if (state === prevStateRef.current) return;
    prevStateRef.current = state;
    if (state && "success" in state && state.success) {
      // Save persists the full form snapshot at once, so every AI-suggested
      // mark clears together on success. Deferred via setTimeout (same
      // workaround already used by connect-store-dialog.tsx's DialogError)
      // since eslint's react-hooks/set-state-in-effect rule disallows
      // calling setState synchronously in an effect body — setConfirmation
      // (the animated-checkmark modal, replacing a plain "Saved" toast per
      // explicit user request) is a setState call too, so it's deferred
      // into the same block rather than called directly above.
      setTimeout(() => {
        setAiSuggested(new Set());
        // Records what's now durably saved, for the Push button's dirty
        // check — deferred into the same setTimeout for the same reason.
        setLastSavedSnapshot(currentSnapshot());
        setConfirmation({ title: "Saved", description: "Your changes have been saved." });
      }, 0);
      // A successful Save is also what actually uploads any staged images
      // to Vercel Blob (see uploadPendingImages above) — reading the latest
      // pendingImages by closure, same deliberate "only react to state"
      // design as the rest of this effect.
      uploadPendingImages(pendingImages);
    } else if (state && "error" in state && state.error) {
      toast.error(state.error);
    }
    // Deliberately only reacts to `state` (a save completing) — currentSnapshot/
    // pendingImages read the latest render's values by closure on purpose,
    // and shouldn't re-run this effect on every keystroke/drop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

          {mode === "edit" && product && (
            <ProductImagesErrorBoundary>
              <ProductImages
                productId={product.id}
                images={gallery}
                pendingImages={pendingImages}
                onFilesAdded={handleFilesAdded}
                onRemovePending={handleRemovePending}
                isUploadingPending={isUploadingPending}
              />
            </ProductImagesErrorBoundary>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDescriptionAiOpen(true)}
              >
                <Sparkles className="size-4" />
                {hasDescription ? "Improve with AI" : "Generate with AI"}
              </Button>
            </div>
            <RichTextEditor
              defaultValue={product?.description ?? ""}
              onChange={setDescriptionHtml}
              externalContent={descriptionExternalContent}
            />
            <input type="hidden" name="description" value={descriptionHtml} readOnly />
            {fieldErrors?.description && (
              <p className="text-sm text-destructive">{fieldErrors.description}</p>
            )}
          </div>

          <Dialog open={isDescriptionAiOpen} onOpenChange={setIsDescriptionAiOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{hasDescription ? "Improve description" : "Generate description"}</DialogTitle>
                <DialogDescription>
                  {hasDescription
                    ? "Optionally tell the AI what to change — tone, length, what to emphasize. Leave blank for a general improvement pass."
                    : "Describe the product in your own words and the AI will write a formatted description from it."}
                </DialogDescription>
              </DialogHeader>
              <Textarea
                placeholder={
                  hasDescription
                    ? "e.g. make it punchier and mention it's handmade"
                    : "e.g. a waterproof canvas backpack with a padded laptop sleeve, for commuters"
                }
                value={descriptionInstructions}
                onChange={(event) => setDescriptionInstructions(event.target.value)}
                rows={4}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsDescriptionAiOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" disabled={isGeneratingDescription} onClick={handleGenerateDescription}>
                  {isGeneratingDescription ? "Generating..." : hasDescription ? "Improve" : "Generate"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
                <SelectValue>{(value: string | null) => (value === "ACTIVE" ? "Active" : "Draft")}</SelectValue>
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
              <div>
                <Button type="button" variant="outline" size="sm" disabled={isSuggesting} onClick={handleSuggest}>
                  <Sparkles className="size-4" />
                  {isSuggesting ? "Suggesting..." : "Suggest SEO & tags"}
                </Button>
              </div>

              <div
                className={cn(
                  "flex flex-col gap-2 rounded-lg p-2",
                  aiSuggested.has("seoTitle") && "bg-primary-subtle"
                )}
              >
                <Label htmlFor="seoTitle">SEO title</Label>
                <Input
                  id="seoTitle"
                  name="seoTitle"
                  value={seoTitle}
                  onChange={(event) => {
                    setSeoTitle(event.target.value);
                    clearSuggested("seoTitle");
                  }}
                />
              </div>

              <div
                className={cn(
                  "flex flex-col gap-2 rounded-lg p-2",
                  aiSuggested.has("seoDescription") && "bg-primary-subtle"
                )}
              >
                <Label htmlFor="seoDescription">SEO description</Label>
                <Textarea
                  id="seoDescription"
                  name="seoDescription"
                  value={seoDescription}
                  onChange={(event) => {
                    setSeoDescription(event.target.value);
                    clearSuggested("seoDescription");
                  }}
                />
              </div>

              <div
                className={cn(
                  "flex flex-col gap-2 rounded-lg p-2",
                  aiSuggested.has("collection") && "bg-primary-subtle"
                )}
              >
                <Label htmlFor="collection">Collection</Label>
                <Select
                  value={collectionId || NO_COLLECTION_VALUE}
                  onValueChange={(value) => {
                    clearSuggested("collection");
                    if (!value || value === NO_COLLECTION_VALUE) {
                      setCollectionId("");
                      setCollectionTitle("");
                      return;
                    }
                    setCollectionId(value);
                    setCollectionTitle(collections.find((c) => c.id === value)?.title ?? "");
                  }}
                >
                  <SelectTrigger id="collection" className="max-w-72">
                    <SelectValue>
                      {(value: string | null) =>
                        !value || value === NO_COLLECTION_VALUE
                          ? "No collection"
                          : (collections.find((c) => c.id === value)?.title ?? "No collection")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_COLLECTION_VALUE}>No collection</SelectItem>
                    {collections.map((collection) => (
                      <SelectItem key={collection.id} value={collection.id}>
                        {collection.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="collectionId" value={collectionId} />
                <input type="hidden" name="collectionTitle" value={collectionTitle} />
              </div>

              <div
                className={cn(
                  "flex flex-col gap-2 rounded-lg p-2",
                  aiSuggested.has("tags") && "bg-primary-subtle"
                )}
              >
                <Label htmlFor="tags">Tags</Label>
                <TagInput
                  tags={tags}
                  onChange={(next) => {
                    setTags(next);
                    clearSuggested("tags");
                  }}
                />
                <input type="hidden" name="tags" value={JSON.stringify(tags)} />
              </div>

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
            {mode === "edit" && product && (
              <Button
                type="button"
                variant="outline"
                disabled={isDirty || pushStatus === "pushing"}
                title={isDirty ? "Save your changes before publishing" : undefined}
                onClick={handlePush}
              >
                {pushStatus === "pushing"
                  ? product.shopifyProductId
                    ? "Republishing..."
                    : "Publishing..."
                  : product.shopifyProductId
                  ? "Republish to Shopify"
                  : "Publish to Shopify"}
              </Button>
            )}
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
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setLightboxOpen(true)}
                    className="relative h-48 w-full shrink-0 overflow-hidden rounded-lg border border-border p-0 hover:opacity-90"
                    aria-label="View full-size image"
                  >
                    <Image
                      src={mainImage}
                      alt={title || "Product image"}
                      fill
                      sizes="(max-width: 1024px) 100vw, 480px"
                      className="object-cover object-top"
                    />
                    <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-background/80 text-foreground">
                      <Maximize2 className="size-4" />
                    </span>
                  </Button>
                ) : (
                  <div className="flex h-48 w-full items-center justify-center rounded-lg border border-border bg-muted">
                    <ImageOff className="size-8 text-muted-foreground" />
                  </div>
                )}
                {gallery.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {gallery.map((url, index) => (
                      <Button
                        key={url + index}
                        type="button"
                        variant="ghost"
                        onClick={() => setSelectedImageIndex(index)}
                        className={`relative size-12 shrink-0 overflow-hidden rounded-md border p-0 ${
                          index === selectedImageIndex ? "border-primary ring-2 ring-primary" : "border-border"
                        }`}
                        aria-label={`Show image ${index + 1}`}
                        aria-pressed={index === selectedImageIndex}
                      >
                        <Image src={url} alt="" fill sizes="48px" className="object-cover" />
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <ProductImageLightbox
                open={lightboxOpen}
                onOpenChange={setLightboxOpen}
                images={gallery}
                selectedIndex={selectedImageIndex}
                onSelectIndex={setSelectedImageIndex}
                title={title}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-page-title font-semibold text-foreground">
                  {title || "Untitled product"}
                </h2>
                <PreviewStatusBadge status={status} />
              </div>
              <span className="font-mono text-table-data text-foreground">{price || "0.00"}</span>
              <span className="text-sm text-muted-foreground">
                {collectionTitle || "No collection"}
              </span>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
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

      <AiDescriptionReviewDialog
        open={isDescriptionReviewOpen}
        onOpenChange={setIsDescriptionReviewOpen}
        currentDescriptionHtml={descriptionHtml}
        suggestedDescriptionHtml={pendingDescriptionHtml}
        onAccept={handleAcceptDescription}
      />

      {pendingSeoSuggestion && (
        <AiSeoReviewDialog
          open={isSeoReviewOpen}
          onOpenChange={setIsSeoReviewOpen}
          current={{
            seoTitle,
            seoDescription,
            tags,
            collectionId,
            collectionTitle,
          }}
          suggested={pendingSeoSuggestion}
          collections={collections}
          onAccept={handleAcceptSeo}
        />
      )}
      <ActionConfirmationModal
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        title={confirmation?.title ?? ""}
        description={confirmation?.description}
      />
    </div>
  );
}
