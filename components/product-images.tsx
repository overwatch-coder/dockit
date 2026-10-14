"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDropzone, type FileRejection } from "react-dropzone";
import Image from "next/image";
import { Clock, ImagePlus, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { removeProductImage } from "@/app/(dashboard)/products/actions";
import { productThumbnailUrl } from "@/lib/shopify/image-url";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Mirrors app/(dashboard)/products/actions.ts's own MAX_IMAGE_BYTES/
// ALLOWED_IMAGE_TYPES — checked here too so a bad drop is rejected
// instantly client-side instead of round-tripping to the server first, but
// the server-side check remains the real source of truth (never trust a
// client-side check alone).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": [],
  "image/png": [],
  "image/webp": [],
  "image/gif": [],
};

// A dropped/selected file that hasn't been uploaded to Vercel Blob yet —
// held purely in browser memory (components/product-form.tsx owns this
// array) so dropping an image is instant and removing one before Save costs
// nothing. `previewUrl` is a local `URL.createObjectURL(file)` blob: URL,
// unrelated to (and never confused with) a real Vercel Blob URL.
export type PendingImage = { id: string; file: File; previewUrl: string };

// Staging workflow: dropping/selecting a file stages a local preview
// owned by the parent form to be uploaded upon Save. Persisted images
// are removed via immediate server call.
//
// Uses react-dropzone for drag-and-drop on top of click-to-browse — shadcn
// has no first-party file upload/dropzone primitive in this project's
// registry, so this is a plain styled wrapper around react-dropzone's hook
// rather than a shadcn component.
export function ProductImages({
  productId,
  images,
  pendingImages,
  onFilesAdded,
  onRemovePending,
  isUploadingPending,
  onOpenGenerateDialog,
  onReorderImages,
}: {
  productId: string;
  images: string[];
  pendingImages: PendingImage[];
  onFilesAdded: (files: File[]) => void;
  onRemovePending: (id: string) => void;
  isUploadingPending: boolean;
  onOpenGenerateDialog?: () => void;
  onReorderImages?: (newImages: string[]) => void;
}) {
  const router = useRouter();
  const [isRemoving, startTransition] = useTransition();
  const isBusy = isRemoving || isUploadingPending;
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function handleReorder(from: number, to: number) {
    if (from === to || !onReorderImages) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorderImages(next);
  }

  function handleDrop(acceptedFiles: File[], rejections: FileRejection[]) {
    for (const rejection of rejections) {
      const reason =
        rejection.errors[0]?.code === "file-too-large" ? "must be 5MB or smaller" : "unsupported file type";
      toast.error(`${rejection.file.name}: ${reason}`);
    }
    if (acceptedFiles.length > 0) {
      onFilesAdded(acceptedFiles);
    }
  }

  function handleRemove(url: string) {
    startTransition(async () => {
      const result = await removeProductImage(productId, url);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Image removed");
      router.refresh();
    });
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ALLOWED_IMAGE_TYPES,
    maxSize: MAX_IMAGE_BYTES,
    multiple: true,
    disabled: isBusy,
    onDrop: handleDrop,
    noKeyboard: true,
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Images</Label>
        {onOpenGenerateDialog && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenGenerateDialog}
            className="h-7 gap-1.5 px-2 text-xs text-primary hover:bg-primary/10"
          >
            <Wand2 className="size-3.5" />
            Generate Images with AI
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {images.map((url, index) => (
          <div
            key={url}
            draggable={Boolean(onReorderImages)}
            onDragStart={(e) => {
              setDraggedIndex(index);
              e.dataTransfer.setData("text/plain", String(index));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDragEnter={() => setDragOverIndex(index)}
            onDragEnd={() => {
              setDraggedIndex(null);
              setDragOverIndex(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedIndex !== null) {
                handleReorder(draggedIndex, index);
              }
              setDraggedIndex(null);
              setDragOverIndex(null);
            }}
            className={cn(
              "group relative size-16 shrink-0 overflow-hidden rounded-md border transition-all select-none",
              onReorderImages && "cursor-grab active:cursor-grabbing",
              index === 0 ? "border-primary/80 ring-1 ring-primary/40 shadow-xs" : "border-border",
              dragOverIndex === index && "ring-2 ring-primary scale-105",
              draggedIndex === index && "opacity-40"
            )}
            title={index === 0 ? "Hero Image (drag to reorder)" : `Image ${index + 1} (drag to reorder)`}
          >
            <Image src={productThumbnailUrl(url, 128)} alt="" fill sizes="64px" className="object-cover" />
            {index === 0 && (
              <span className="absolute bottom-0 left-0 right-0 bg-primary/90 text-primary-foreground text-[8px] font-mono text-center font-bold tracking-wider uppercase py-0.5">
                Hero
              </span>
            )}
            <div className="absolute top-0.5 left-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {index > 0 && onReorderImages && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReorder(index, index - 1);
                  }}
                  className="size-4 rounded bg-background/90 text-foreground flex items-center justify-center text-[10px] hover:bg-background cursor-pointer"
                  aria-label="Move left"
                  title="Move left"
                >
                  ‹
                </button>
              )}
              {index < images.length - 1 && onReorderImages && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReorder(index, index + 1);
                  }}
                  className="size-4 rounded bg-background/90 text-foreground flex items-center justify-center text-[10px] hover:bg-background cursor-pointer"
                  aria-label="Move right"
                  title="Move right"
                >
                  ›
                </button>
              )}
            </div>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              disabled={isBusy}
              onClick={() => handleRemove(url)}
              aria-label="Remove image"
              className="absolute top-0.5 right-0.5 size-5 bg-background/90 text-destructive opacity-0 hover:bg-background hover:text-destructive group-hover:opacity-100"
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
        {pendingImages.map((pending) => (
          <div
            key={pending.id}
            className="group relative size-16 shrink-0 overflow-hidden rounded-md border border-dashed border-primary/60"
            title="Not uploaded yet — will upload when you save"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: object URL, next/image's remote-pattern allowlist doesn't apply. */}
            <img src={pending.previewUrl} alt="" className="size-full object-cover opacity-80" />
            <span className="absolute bottom-0.5 left-0.5 flex size-4 items-center justify-center rounded-sm bg-background/90 text-primary">
              <Clock className="size-2.5" />
            </span>
            {!isUploadingPending && (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                disabled={isBusy}
                onClick={() => onRemovePending(pending.id)}
                aria-label="Remove staged image"
                className="absolute top-0.5 right-0.5 size-5 bg-background/90 text-destructive opacity-0 hover:bg-background hover:text-destructive group-hover:opacity-100"
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {pendingImages.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {isUploadingPending
            ? "Uploading..."
            : `${pendingImages.length} image${pendingImages.length === 1 ? "" : "s"} staged — will upload when you save.`}
        </p>
      )}
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input px-4 py-6 text-center text-xs text-muted-foreground transition-colors",
          isDragActive && "border-primary bg-primary-subtle text-primary",
          isBusy && "opacity-60",
          !isBusy && "cursor-pointer hover:border-primary/60 hover:text-foreground"
        )}
      >
        <input {...getInputProps()} />
        <ImagePlus className="size-5" />
        <span>{isDragActive ? "Drop images to stage" : "Drag images here, or click to browse"}</span>
        <span className="text-muted-foreground/70">JPEG, PNG, WebP, or GIF, up to 5MB each — uploaded on Save</span>
      </div>
    </div>
  );
}
