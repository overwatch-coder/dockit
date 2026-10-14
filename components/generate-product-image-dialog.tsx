"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { productThumbnailUrl } from "@/lib/shopify/image-url";
import {
  Wand2,
  Sparkles,
  Camera,
  Layers,
  Check,
  Loader2,
  Image as ImageIcon,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  Info,
  Package,
  Shirt,
  User,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useJobPolling } from "@/lib/hooks/use-job-polling";
import { enqueueGenerateProductImagesAction } from "@/app/(dashboard)/products/actions";
import type { ImageAspectRatio, ImageGenerationMode, ImageProviderName, PresentationStyle } from "@/lib/ai/contracts";
import type { ImageGenerationJobResult } from "@/types/job";
import { cn } from "@/lib/utils";

interface GenerateProductImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    title: string;
    imageUrl?: string | null;
    imageUrls?: string[];
  };
  defaultPresentationStyle?: PresentationStyle;
  defaultModelFaceNotes?: string;
  onGenerated?: (newUrls: string[]) => void;
}


const MODES: Array<{
  id: ImageGenerationMode;
  label: string;
  tagline: string;
  desc: string;
  bestFor: string;
  icon: typeof Sparkles;
}> = [
  {
    id: "variation",
    label: "Variation",
    tagline: "Studio variations",
    desc: "Generate creative variations in a clean commercial studio setting while keeping your product's core identity intact.",
    bestFor: "Catalog diversity, lifestyle context, and fresh marketing variants.",
    icon: Layers,
  },
  {
    id: "refine",
    label: "Refine",
    tagline: "Clarity & textures",
    desc: "Enhance image clarity, polish lighting, and sharpen intricate textures without altering product geometry.",
    bestFor: "Polishing blurry supplier photos, studio lighting, and crisp detail shots.",
    icon: Sparkles,
  },
  {
    id: "angle",
    label: "New Angle",
    tagline: "Side, 45°, flat lay",
    desc: "Render alternative perspectives such as 45° commercial angles, flat-lay overhead layouts, or side profiles.",
    bestFor: "Adding multi-angle gallery depth, dimension, and packaging viewpoints.",
    icon: Camera,
  },
  {
    id: "custom",
    label: "Custom",
    tagline: "Prompt-directed",
    desc: "Full creative control driven by your custom directives, specific scene styling, props, and backdrops.",
    bestFor: "Themed holiday campaigns, bold seasonal sets, and bespoke creative concepts.",
    icon: Wand2,
  },
];

const PRESENTATION_STYLES: Array<{
  id: PresentationStyle;
  label: string;
  tagline: string;
  desc: string;
  icon: typeof UserCheck;
}> = [
  {
    id: "product_only",
    label: "Product Only",
    tagline: "Studio flat lay",
    desc: "Clean commercial product shot on a seamless studio background without any model or mannequin.",
    icon: Package,
  },
  {
    id: "on_model",
    label: "On-Model (Keep Face)",
    tagline: "Preserve model face & identity",
    desc: "Apparel worn by the human model from your photos. Strictly preserves facial identity, expression, hairstyle, and skin tone across all generated shots and variants.",
    icon: UserCheck,
  },
  {
    id: "ghost_mannequin",
    label: "Ghost Mannequin",
    tagline: "3D hollow body drape",
    desc: "Invisible mannequin effect where garments appear floating in 3D with realistic hollow neckline, inner lining, and natural fabric drape.",
    icon: Shirt,
  },
  {
    id: "studio_mannequin",
    label: "Studio Mannequin",
    tagline: "Tailor dummy / mannequin",
    desc: "Garment displayed on a minimalist matte studio dress form or tailor mannequin with soft catalog shadows.",
    icon: User,
  },
];

const RATIOS: Array<{
  ratio: ImageAspectRatio;
  label: string;
  size: string;
  aspectClass: string;
  desc: string;
  useCase: string;
}> = [
  {
    ratio: "1:1",
    label: "Square (1:1)",
    size: "1024x1024",
    aspectClass: "aspect-square",
    desc: "Standard 1:1 Square (1024 × 1024 px)",
    useCase: "Shopify primary catalog cards, square grids, and Instagram posts.",
  },
  {
    ratio: "4:3",
    label: "Standard (4:3)",
    size: "1024x768",
    aspectClass: "aspect-[4/3]",
    desc: "Horizontal 4:3 Standard (1024 × 768 px)",
    useCase: "Traditional desktop e-commerce catalog listings and web galleries.",
  },
  {
    ratio: "16:9",
    label: "Banner (16:9)",
    size: "1792x1024",
    aspectClass: "aspect-video",
    desc: "Widescreen 16:9 Banner (1792 × 1024 px)",
    useCase: "Hero banners, homepage featured sliders, and collection header imagery.",
  },
  {
    ratio: "3:4",
    label: "Vertical (3:4)",
    size: "1024x1365",
    aspectClass: "aspect-[3/4]",
    desc: "Vertical 3:4 Portrait (1024 × 1365 px)",
    useCase: "Fashion lookbooks, apparel models, and vertical product card layouts.",
  },
  {
    ratio: "9:16",
    label: "Story (9:16)",
    size: "1024x1792",
    aspectClass: "aspect-[9/16]",
    desc: "Full-bleed 9:16 Story (1024 × 1792 px)",
    useCase: "Mobile-first shopping experiences, TikTok, and Instagram Stories/Reels.",
  },
];

const QUICK_CHIPS = [
  "Pure white studio background",
  "Warm lifestyle aesthetic",
  "45° commercial hero angle",
  "Macro close-up texture",
  "Flat-lay overhead arrangement",
];

export function GenerateProductImageDialog({
  open,
  onOpenChange,
  product,
  defaultPresentationStyle,
  defaultModelFaceNotes,
  onGenerated,
}: GenerateProductImageDialogProps) {
  const router = useRouter();

  // Reference images
  const allImages = Array.from(
    new Set([
      ...(product.imageUrl ? [product.imageUrl] : []),
      ...(product.imageUrls || []),
    ])
  );

  const [selectedRefUrl, setSelectedRefUrl] = useState<string | null>(
    allImages[0] ?? null
  );

  // Settings
  const [mode, setMode] = useState<ImageGenerationMode>("variation");
  const [presentationStyle, setPresentationStyle] = useState<PresentationStyle>(
    defaultPresentationStyle ?? "product_only"
  );
  const [modelFaceNotes, setModelFaceNotes] = useState(
    defaultModelFaceNotes ?? ""
  );
  const [selectedModelFaceUrl, setSelectedModelFaceUrl] = useState<string | null>(
    allImages[0] ?? null
  );

  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>("1:1");
  const [provider, setProvider] = useState<ImageProviderName | "auto">("auto");
  const [count, setCount] = useState<number>(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Job execution state
  const [isStarting, setIsStarting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<"IDLE" | "RUNNING" | "SUCCEEDED" | "FAILED">("IDLE");
  const [completedUrls, setCompletedUrls] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressInfo, setProgressInfo] = useState<{
    progress: number;
    stage: string;
  }>({
    progress: 15,
    stage: "Preparing visual references & directives…",
  });

  const { isPolling, start: startPolling } = useJobPolling({
    intervalMs: 1500,
    onProgress: (results) => {
      const r = results as { progress?: number; stage?: string } | undefined;
      if (typeof r?.progress === "number") {
        setProgressInfo({
          progress: Math.min(Math.max(r.progress, 15), 98),
          stage: r.stage || "Rendering product variations with AI…",
        });
      }
    },
    onSettled: (status, results) => {
      if (status === "SUCCEEDED") {
        setJobStatus("SUCCEEDED");
        const res = results as ImageGenerationJobResult | undefined;
        const newUrls = (res && "generatedUrls" in res && Array.isArray(res.generatedUrls))
          ? res.generatedUrls
          : [];
        setCompletedUrls(newUrls);
        toast.success(
          newUrls.length > 0
            ? `Generated ${newUrls.length} new image${newUrls.length === 1 ? "" : "s"}!`
            : "Image generation completed!"
        );
        onGenerated?.(newUrls);
        router.refresh();
      } else {
        setJobStatus("FAILED");
        const res = results as { error?: string } | undefined;
        const err = res?.error ?? "Image generation failed.";
        setErrorMessage(err);
        toast.error(err);
      }
    },
    onError: (err) => {
      setJobStatus("FAILED");
      setErrorMessage(err);
    },
  });

  const handleStartGeneration = async () => {
    setIsStarting(true);
    setErrorMessage(null);
    setJobStatus("RUNNING");
    setProgressInfo({
      progress: 15,
      stage: "Connecting to AI background pipeline…",
    });

    try {
      const selectedRatioObj = RATIOS.find((r) => r.ratio === aspectRatio);
      const res = await enqueueGenerateProductImagesAction({
        productId: product.id,
        prompt,
        referenceImageUrl: selectedRefUrl,
        referenceModelFaceUrl:
          presentationStyle === "on_model" ? (selectedModelFaceUrl || selectedRefUrl) : undefined,
        presentationStyle,
        modelFaceNotes: presentationStyle === "on_model" ? modelFaceNotes : undefined,
        aspectRatio,
        size: selectedRatioObj?.size,
        mode,
        provider: provider === "auto" ? undefined : provider,
        count,
      });

      if ("error" in res) {
        setJobStatus("FAILED");
        setErrorMessage(res.error);
        toast.error(res.error);
        setIsStarting(false);
        return;
      }

      setActiveJobId(res.jobId);
      setIsStarting(false);
      startPolling(res.jobId);
      toast.info("Image generation running in background. You can continue working freely!", {
        duration: 4000,
      });
    } catch (err) {
      setIsStarting(false);
      setJobStatus("FAILED");
      const msg = err instanceof Error ? err.message : "Failed to start generation.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const handleReset = () => {
    setJobStatus("IDLE");
    setActiveJobId(null);
    setCompletedUrls([]);
    setErrorMessage(null);
    setProgressInfo({
      progress: 15,
      stage: "Preparing visual references & directives…",
    });
  };

  const isGenerating = isStarting || isPolling;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isGenerating) {
          // Allow closing dialog without canceling the background job
          toast.info("Image generation is continuing in the background.");
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wand2 className="size-4" />
            </div>
            <div>
              <DialogTitle>AI Image Generation Pipeline</DialogTitle>
              <DialogDescription className="text-xs">
                Generate variations, refine details, or render new angles for{" "}
                <span className="font-semibold text-foreground">{product.title}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Running State View */}
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
            <div className="relative flex size-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
              <div className="size-14 rounded-full border-2 border-primary/30 bg-primary/10 flex items-center justify-center">
                <Loader2 className="size-7 text-primary animate-spin" />
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
                <span>Generating Images in Background</span>
                <span className="font-mono text-primary font-bold">({progressInfo.progress}%)</span>
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm">
                AI is generating your product imagery. You can close this window at any time and continue editing products — Dockit will update the gallery automatically.
              </p>
            </div>

            {/* Live Progress Bar with Stage Indicator */}
            <div className="w-full max-w-sm space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground truncate max-w-[240px] text-left">
                  {progressInfo.stage}
                </span>
                <span className="font-mono font-bold text-primary shrink-0">
                  {progressInfo.progress}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-primary/15 border border-primary/20">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${Math.max(progressInfo.progress, 15)}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="gap-1.5 text-xs font-medium cursor-pointer"
              >
                <Minimize2 className="size-3.5" />
                Continue Working in Background & Close
              </Button>
            </div>
          </div>
        ) : jobStatus === "SUCCEEDED" ? (
          /* Succeeded Result View */
          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
              <Check className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <span className="font-semibold">Generation Complete!</span>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                  {completedUrls.length} image{completedUrls.length === 1 ? "" : "s"} generated
                  and added to your product gallery.
                </p>
              </div>
            </div>

            {completedUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2.5">
                {completedUrls.map((url, idx) => (
                  <div
                    key={url}
                    className="group relative aspect-square overflow-hidden rounded-lg border bg-muted shadow-sm"
                  >
                    <Image
                      src={productThumbnailUrl(url, 360)}
                      alt={`Generated variation ${idx + 1}`}
                      fill
                      sizes="180px"
                      className="object-cover"
                    />
                    <div className="absolute bottom-1 right-1 rounded bg-background/80 px-1 text-[10px] font-mono text-muted-foreground">
                      #{idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                Generate More Images
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Configuration Setup View */
          <TooltipProvider delay={100}>
            <div className="space-y-4 py-2 text-left">
              {errorMessage && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Error:</span>
                    <p className="text-[11px] mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* 1. Reference Image Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">1. Seed / Reference Image</Label>
                  <span className="text-[11px] text-muted-foreground">Select photo or run seedless</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Select an existing product photo for the model to use as reference:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {allImages.length > 0 ? (
                    allImages.map((url, idx) => {
                      const isSelected = selectedRefUrl === url;
                      return (
                        <Tooltip key={url}>
                          <TooltipTrigger
                            type="button"
                            onClick={() => setSelectedRefUrl(url)}
                            className={cn(
                              "relative size-14 shrink-0 overflow-hidden rounded-md border transition-all cursor-pointer",
                              isSelected
                                ? "ring-2 ring-primary border-primary shadow-sm"
                                : "opacity-70 hover:opacity-100 border-border"
                            )}
                          >
                            <Image
                              src={productThumbnailUrl(url, 120)}
                              alt={`Ref photo ${idx + 1}`}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                            {isSelected && (
                              <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="size-2.5" />
                              </span>
                            )}
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs p-2.5 space-y-0.5 shadow-md">
                            <p className="font-semibold text-xs text-background">Reference Image #{idx + 1}</p>
                            <p className="text-[11px] text-background/80">
                              Uses this product photo as visual guidance for shape, colors, and textures.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No images uploaded yet. Generation will create images from prompt and product title.
                    </p>
                  )}

                  <Tooltip>
                    <TooltipTrigger
                      type="button"
                      onClick={() => setSelectedRefUrl(null)}
                      className={cn(
                        "flex size-14 shrink-0 flex-col items-center justify-center rounded-md border text-[10px] transition-all cursor-pointer",
                        selectedRefUrl === null
                          ? "ring-2 ring-primary border-primary bg-primary/5 text-primary font-medium"
                          : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-foreground/50"
                      )}
                    >
                      <ImageIcon className="size-4 mb-0.5" />
                      <span>No Seed</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-2.5 space-y-0.5 shadow-md">
                      <p className="font-semibold text-xs text-background">Seedless Generation</p>
                      <p className="text-[11px] text-background/80">
                        Generates entirely from your directive instructions and product title without using an existing reference image.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* 2. Generation Mode */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">2. Pipeline Mode</Label>
                  <span className="text-[11px] text-muted-foreground">Hover options for full details</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MODES.map((item) => {
                    const Icon = item.icon;
                    const isSelected = mode === item.id;
                    return (
                      <Tooltip key={item.id}>
                        <TooltipTrigger
                          type="button"
                          onClick={() => setMode(item.id)}
                          className={cn(
                            "group relative flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-all w-full cursor-pointer",
                            isSelected
                              ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary shadow-xs"
                              : "border-border hover:bg-muted/50 text-muted-foreground hover:border-foreground/20"
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                              <Icon className="size-3.5 text-primary" />
                              <span>{item.label}</span>
                            </div>
                            <Info className="size-3 text-muted-foreground/60 transition-colors group-hover:text-primary" />
                          </div>
                          <p className="text-[10px] font-medium text-muted-foreground leading-tight">
                            {item.tagline}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center" className="max-w-xs p-3 space-y-1.5 shadow-md">
                          <div className="flex items-center gap-1.5 font-semibold text-xs text-background">
                            <Icon className="size-3.5 text-primary" />
                            <span>{item.label} Mode</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-background/90">
                            {item.desc}
                          </p>
                          <div className="pt-1 border-t border-background/20 text-[10px] text-background/80 font-medium">
                            💡 {item.bestFor}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Live Active Mode Full Description Callout */}
                {(() => {
                  const activeModeObj = MODES.find((m) => m.id === mode) ?? MODES[0];
                  const ActiveIcon = activeModeObj.icon;
                  return (
                    <div className="flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/5 p-2.5 text-xs">
                      <div className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary shrink-0 mt-0.5">
                        <ActiveIcon className="size-3.5" />
                      </div>
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground text-xs">
                            {activeModeObj.label} Mode
                          </span>
                          <span className="rounded bg-primary/15 px-1.5 py-0.2 text-[9px] font-medium text-primary">
                            Active Selection
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {activeModeObj.desc}
                        </p>
                        <p className="text-[10px] text-muted-foreground/80 font-medium pt-0.5">
                          💡 {activeModeObj.bestFor}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 3. Presentation & Subject (Mannequins & Faces) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">3. Presentation & Subject</Label>
                  <span className="text-[11px] text-muted-foreground">Apparel drape, mannequins & faces</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PRESENTATION_STYLES.map((item) => {
                    const Icon = item.icon;
                    const isSelected = presentationStyle === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPresentationStyle(item.id)}
                        className={cn(
                          "group relative flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-all w-full cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary shadow-xs"
                            : "border-border hover:bg-muted/50 text-muted-foreground hover:border-foreground/20"
                        )}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Icon className="size-3.5 text-primary" />
                          <span>{item.label}</span>
                        </div>
                        <p className="text-[10px] font-medium text-muted-foreground leading-tight">
                          {item.tagline}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* On-Model Face & Identity Consistency Card */}
                {presentationStyle === "on_model" && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5 text-xs animate-in fade-in-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-primary">
                        <UserCheck className="size-4" />
                        <span>Face & Identity Preservation Active</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-background">
                        Consistent Model Identity
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      AI will maintain 100% facial structure, skin tone, expression, and hair fidelity based on the reference model photo.
                    </p>

                    {allImages.length > 1 && (
                      <div className="space-y-1 pt-1">
                        <Label className="text-[11px] font-medium">Select Model Face Photo</Label>
                        <div className="flex flex-wrap gap-2">
                          {allImages.map((url, idx) => {
                            const isFaceRef = (selectedModelFaceUrl || selectedRefUrl) === url;
                            return (
                              <button
                                key={url}
                                type="button"
                                onClick={() => setSelectedModelFaceUrl(url)}
                                className={cn(
                                  "relative size-12 shrink-0 overflow-hidden rounded-md border transition-all cursor-pointer",
                                  isFaceRef
                                    ? "ring-2 ring-primary border-primary shadow-xs"
                                    : "opacity-70 hover:opacity-100 border-border"
                                )}
                              >
                                <Image
                                  src={productThumbnailUrl(url, 100)}
                                  alt={`Model face ${idx + 1}`}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                                {isFaceRef && (
                                  <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-primary-foreground text-[8px] font-semibold text-center py-0.5">
                                    Face Ref
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 pt-1">
                      <Label htmlFor="model-notes" className="text-[11px] font-medium">
                        Model / Face Directives (Optional)
                      </Label>
                      <Input
                        id="model-notes"
                        value={modelFaceNotes}
                        onChange={(e) => setModelFaceNotes(e.target.value)}
                        placeholder="e.g. Preserve female model with brunette hair, smiling expression, natural makeup"
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Custom Prompt & Suggestions */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="image-prompt" className="text-xs font-semibold">
                    4. Directive / Instructions
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Optional</span>
                </div>
                <Textarea
                  id="image-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Crisp commercial lighting on polished white acrylic, product angled at 45 degrees, ultra sharp reflections..."
                  className="text-xs min-h-[64px]"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() =>
                        setPrompt((prev) => (prev ? `${prev}, ${chip}` : chip))
                      }
                      className="rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Aspect Ratio & Dimensions */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">5. Aspect Ratio & Canvas</Label>
                  <span className="text-[11px] text-muted-foreground">Hover to view resolution & best use</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {RATIOS.map((item) => (
                    <Tooltip key={item.ratio}>
                      <TooltipTrigger
                        type="button"
                        onClick={() => setAspectRatio(item.ratio)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all cursor-pointer",
                          aspectRatio === item.ratio
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <span>{item.label}</span>
                        <span className="font-mono text-[10px] opacity-60">{item.size}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs p-2.5 space-y-0.5 shadow-md">
                        <p className="font-semibold text-xs text-background">{item.desc}</p>
                        <p className="text-[11px] text-background/80">{item.useCase}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Collapsible Advanced AI Model Settings */}
              <div className="rounded-lg border bg-muted/20">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex w-full items-center justify-between p-2.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="size-3.5" />
                    Advanced Provider & Variation Batch
                  </span>
                  {showAdvanced ? (
                    <ChevronUp className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="space-y-3 border-t p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">AI Generation Model</p>
                        <p className="text-[11px] text-muted-foreground">
                          Select which provider runs the image generation task
                        </p>
                      </div>
                      <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as ImageProviderName | "auto")}
                        className="rounded-md border bg-background px-2.5 py-1 text-xs"
                      >
                        <option value="auto">Auto (Smart Default)</option>
                        <option value="gemini">Google Gemini (2.5 Flash Image)</option>
                        <option value="openai">OpenAI (DALL-E 3)</option>
                        <option value="kie">Kie.ai (Nano Banana Pro)</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between border-t pt-2.5">
                      <div>
                        <p className="font-medium text-foreground">Variation Count</p>
                        <p className="text-[11px] text-muted-foreground">
                          Number of images to generate in the background job
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3].map((num) => (
                          <Tooltip key={num}>
                            <TooltipTrigger
                              type="button"
                              onClick={() => setCount(num)}
                              className={cn(
                                "size-7 rounded-md border text-xs font-medium transition-all cursor-pointer",
                                count === num
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border text-muted-foreground hover:bg-muted"
                              )}
                            >
                              {num}
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {num === 1 ? "Generate 1 image" : `Generate ${num} images in parallel`}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleStartGeneration}
                  className="gap-1.5"
                >
                  <Wand2 className="size-3.5" />
                  Generate {count > 1 ? `${count} Images` : "Image"} in Background
                </Button>
              </DialogFooter>
            </div>
          </TooltipProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}
