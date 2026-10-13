"use client";

import Image from "next/image";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { GeneratedPerspectiveImage } from "@/lib/validation/ai-vision-enrichment";

interface PhotosTabProps {
  images: GeneratedPerspectiveImage[];
  selectedUrls: Set<string>;
  onToggleUrl: (url: string) => void;
}

export function PhotosTab({ images, selectedUrls, onToggleUrl }: PhotosTabProps) {
  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Generated Alternative Perspectives</Label>
        <span className="text-[11px] text-muted-foreground font-mono">
          {selectedUrls.size} selected of {images.length}
        </span>
      </div>

      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
          No perspective photography was generated (no reference images available, skipped, or failed to render).
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {images.map((img) => {
            const isChecked = selectedUrls.has(img.url);
            return (
              <div
                key={img.url}
                onClick={() => onToggleUrl(img.url)}
                className={`relative flex flex-col overflow-hidden rounded-lg border transition-all cursor-pointer ${
                  isChecked
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border/60 bg-card opacity-60"
                }`}
              >
                <div className="relative aspect-square w-full bg-muted/40">
                  <Image
                    src={img.url}
                    alt={img.label}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 240px"
                  />
                  <div className="absolute top-2 right-2 rounded bg-background/90 p-1 shadow">
                    <Checkbox checked={isChecked} />
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium text-foreground leading-tight">
                    {img.label}
                  </p>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    {img.angle}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
