"use client";

import { useCallback, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

interface ProductImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  title: string;
}

export function ProductImageLightbox({
  open,
  onOpenChange,
  images,
  selectedIndex,
  onSelectIndex,
  title,
}: ProductImageLightboxProps) {
  const totalImages = images.length;
  const currentImage = images[selectedIndex] ?? null;

  const handlePrev = useCallback(() => {
    if (totalImages <= 1) return;
    onSelectIndex((selectedIndex - 1 + totalImages) % totalImages);
  }, [selectedIndex, totalImages, onSelectIndex]);

  const handleNext = useCallback(() => {
    if (totalImages <= 1) return;
    onSelectIndex((selectedIndex + 1) % totalImages);
  }, [selectedIndex, totalImages, onSelectIndex]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handlePrev, handleNext]);

  if (!currentImage) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Full-screen Dark Overlay Backdrop */}
        <DialogOverlay className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md" />

        {/* Centered Lightbox Modal Box */}
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-5xl md:max-w-6xl w-[92vw] h-[85vh] sm:h-[90vh] bg-neutral-950/95 border border-neutral-800 p-4 sm:p-6 text-white shadow-2xl flex flex-col items-center justify-between outline-none z-50 overflow-hidden"
        >
          <DialogTitle className="sr-only">{title || "Product image preview"}</DialogTitle>

          {/* Top Control Bar */}
          <div className="flex items-center justify-between w-full shrink-0 z-10 pb-1">
            <span className="text-xs sm:text-sm font-medium font-mono text-neutral-300 bg-neutral-900/90 px-3 py-1 rounded-full border border-neutral-800 shadow-sm">
              {totalImages > 0 ? `${selectedIndex + 1} / ${totalImages}` : "1 / 1"}
            </span>

            {/* High-contrast Close Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="size-10 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-white border border-neutral-700 transition-all shadow-md focus:ring-2 focus:ring-primary cursor-pointer"
              aria-label="Close image preview"
            >
              <X className="size-5" />
            </Button>
          </div>

          {/* Main Stage with Centered Image and Prev/Next Chevrons */}
          <div className="relative flex-1 w-full min-h-0 flex items-center justify-center my-2">
            {totalImages > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handlePrev}
                className="absolute left-2 sm:left-4 z-20 size-10 sm:size-12 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-white border border-neutral-700 shadow-xl transition-all focus:ring-2 focus:ring-primary cursor-pointer"
                aria-label="Previous image"
              >
                <ChevronLeft className="size-6" />
              </Button>
            )}

            <div className="relative w-full h-full min-h-0 flex items-center justify-center">
              <Image
                src={currentImage}
                alt={title || "Product image"}
                fill
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-contain select-none"
                priority
              />
            </div>

            {totalImages > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="absolute right-2 sm:right-4 z-20 size-10 sm:size-12 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-white border border-neutral-700 shadow-xl transition-all focus:ring-2 focus:ring-primary cursor-pointer"
                aria-label="Next image"
              >
                <ChevronRight className="size-6" />
              </Button>
            )}
          </div>

          {/* Bottom Interactive Thumbnail Bar */}
          {totalImages > 1 && (
            <div className="shrink-0 w-full flex items-center justify-center pt-2 z-10">
              <div className="flex items-center gap-2 overflow-x-auto p-2 bg-neutral-900/90 rounded-2xl border border-neutral-800 max-w-full backdrop-blur-md shadow-lg">
                {images.map((url, index) => {
                  const isActive = index === selectedIndex;
                  return (
                    <button
                      key={url + index}
                      type="button"
                      onClick={() => onSelectIndex(index)}
                      className={`relative size-12 sm:size-16 shrink-0 rounded-xl overflow-hidden transition-all cursor-pointer focus:outline-none ${
                        isActive
                          ? "ring-2 ring-primary border-2 border-white scale-105 opacity-100 shadow-md"
                          : "opacity-60 hover:opacity-100 border border-neutral-700"
                      }`}
                      aria-label={`Go to image ${index + 1}`}
                      aria-pressed={isActive}
                    >
                      <Image src={url} alt="" fill sizes="64px" className="object-cover" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
