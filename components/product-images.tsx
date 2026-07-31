"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { removeProductImage, uploadProductImage } from "@/app/(dashboard)/products/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// Unit 12: draft-state image upload (Vercel Blob) — an immediate action,
// not staged behind the product form's own Save button, since an upload
// has to actually finish before there's a URL to show at all. Only
// rendered in mode="edit" (components/product-form.tsx) — a not-yet-saved
// product has no id for an image to attach to.
export function ProductImages({ productId, images }: { productId: string; images: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    startTransition(async () => {
      const result = await uploadProductImage(productId, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Image uploaded");
      router.refresh();
    });
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

  return (
    <div className="flex flex-col gap-2">
      <Label>Images</Label>
      <div className="flex flex-wrap gap-2">
        {images.map((url) => (
          <div key={url} className="group relative size-16 shrink-0 overflow-hidden rounded-md border border-border">
            <Image src={url} alt="" fill sizes="64px" className="object-cover" />
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              disabled={isPending}
              onClick={() => handleRemove(url)}
              aria-label="Remove image"
              className="absolute top-0.5 right-0.5 size-5 bg-background/90 text-destructive opacity-0 hover:bg-background hover:text-destructive group-hover:opacity-100"
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-16 w-16 flex-col gap-1 p-0 text-xs"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="size-4" />
          Upload
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
