"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  Sparkles,
  Check,
  Camera,
  Layers,
  FileText,
  Loader2,
  RefreshCw,
  ImageIcon,
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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  generateFullAiProductEnrichmentAction,
  applyFullAiProductEnrichmentAction,
} from "@/app/(dashboard)/products/actions";
import type {
  FullAiVisionEnrichmentResult,
  EnrichedProductFields,
  GeneratedPerspectiveImage,
} from "@/lib/validation/ai-vision-enrichment";
import type { TextVisionProviderName, ImageProviderName } from "@/lib/ai/contracts";
import type { Collection } from "@/types/collection";
import { ModelSelector, type ModelSelectorSettings } from "./product-vision-enrich/model-selector";
import { VisionReportCard } from "./product-vision-enrich/vision-report-card";
import { DetailsTab, formatTaxonomyBreadcrumb } from "./product-vision-enrich/details-tab";
import { DescriptionTab } from "./product-vision-enrich/description-tab";
import { SeoTab } from "./product-vision-enrich/seo-tab";
import { PhotosTab } from "./product-vision-enrich/photos-tab";
import { ProgressView } from "./product-vision-enrich/progress-view";

// Re-export for unit tests & backwards compatibility
export { formatTaxonomyBreadcrumb };

export function filterSelectedImages(
  images: GeneratedPerspectiveImage[],
  selectedSet: Set<string>
): string[] {
  return images.filter((img) => selectedSet.has(img.url)).map((img) => img.url);
}

export function getInitialAnglesSelection(images: GeneratedPerspectiveImage[]): Set<string> {
  return new Set(images.map((img) => img.url));
}

interface ProductVisionEnrichDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    title: string;
    price: string;
    description?: string | null;
    imageUrl?: string | null;
    imageUrls?: string[];
    tags?: string[];
    collectionId?: string | null;
    collectionTitle?: string | null;
    categoryId?: string | null;
    categoryFullName?: string | null;
  };
  collections?: Collection[];
  onApplyInEditor?: (fields: EnrichedProductFields, selectedImages: string[]) => void;
  onSavedSuccessfully?: () => void;
}

export function ProductVisionEnrichDialog({
  open,
  onOpenChange,
  product,
  collections = [],
  onApplyInEditor,
  onSavedSuccessfully,
}: ProductVisionEnrichDialogProps) {
  const [modelSettings, setModelSettings] = useState<ModelSelectorSettings>({
    textProvider: "auto",
    imageProvider: "auto",
    generateAngles: true,
  });

  const [isGenerating, startGeneratingTransition] = useTransition();
  const [isApplying, startApplyingTransition] = useTransition();

  const [enrichmentResult, setEnrichmentResult] = useState<FullAiVisionEnrichmentResult | null>(null);
  const [editableFields, setEditableFields] = useState<EnrichedProductFields | null>(null);
  const [selectedImageUrls, setSelectedImageUrls] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("details");

  const existingImages = product.imageUrls?.length
    ? product.imageUrls
    : product.imageUrl
      ? [product.imageUrl]
      : [];

  const handleStartGeneration = () => {
    startGeneratingTransition(async () => {
      const res = await generateFullAiProductEnrichmentAction({
        productId: product.id,
        generateAlternativeImages: modelSettings.generateAngles,
        textProvider:
          modelSettings.textProvider === "auto"
            ? undefined
            : (modelSettings.textProvider as TextVisionProviderName),
        imageProvider:
          modelSettings.imageProvider === "auto"
            ? undefined
            : (modelSettings.imageProvider as ImageProviderName),
      });

      if ("error" in res) {
        toast.error(res.error || "Failed to generate AI vision enhancements.");
        return;
      }

      setEnrichmentResult(res.data);
      setEditableFields(res.data.fields);
      setSelectedImageUrls(getInitialAnglesSelection(res.data.generatedImages));
      toast.success("AI vision analysis & enrichment complete!");
    });
  };

  const handleToggleImage = (url: string) => {
    setSelectedImageUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const handleApply = () => {
    if (!editableFields) return;
    const chosenImages = filterSelectedImages(
      enrichmentResult?.generatedImages || [],
      selectedImageUrls
    );

    if (onApplyInEditor) {
      onApplyInEditor(editableFields, chosenImages);
      toast.success("AI enhancements applied to product editor!");
      onOpenChange(false);
      return;
    }

    startApplyingTransition(async () => {
      const res = await applyFullAiProductEnrichmentAction({
        productId: product.id,
        fields: editableFields,
        selectedImageUrls: chosenImages,
      });

      if ("error" in res) {
        toast.error(res.error || "Failed to save AI enhancements to product.");
        return;
      }

      toast.success("Product successfully enhanced with AI Vision!");
      onSavedSuccessfully?.();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-wider">
            <Sparkles className="size-3.5" />
            <span>Vision AI Catalog Studio</span>
          </div>
          <DialogTitle className="text-xl font-bold">
            Generate All Fields with AI Vision
          </DialogTitle>
          <DialogDescription className="text-xs">
            Analyze photography with multimodal vision, generate standard e-commerce fields (title, rich HTML description, taxonomy, tags, SEO), and render multi-angle photography using modular AI engines (OpenAI, Gemini, Kie.ai).
          </DialogDescription>
        </DialogHeader>

        {/* State 1: Configuration & Pre-Generation */}
        {!enrichmentResult && !isGenerating && (
          <div className="flex flex-col gap-4 py-2">
            {/* Target Product Overview */}
            <div className="flex items-start gap-4 rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/40">
                {existingImages[0] ? (
                  <Image
                    src={existingImages[0]}
                    alt={product.title}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="size-6 opacity-40" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 min-w-0">
                <span className="text-xs font-mono text-muted-foreground">Target Product</span>
                <p className="font-semibold text-foreground truncate">{product.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Price: <span className="font-mono text-foreground font-medium">{product.price || "—"}</span></span>
                  <span>•</span>
                  <span>Photos: <span className="font-mono text-foreground font-medium">{existingImages.length} available</span></span>
                </div>
              </div>
            </div>

            {/* Model & Engine Configuration Abstraction */}
            <ModelSelector
              settings={modelSettings}
              onChange={setModelSettings}
            />

            {/* Feature Highlights Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card p-3">
                <Camera className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-medium text-foreground block">Multimodal Vision</span>
                  <span className="text-[11px] text-muted-foreground">Extracts colors, materials & shapes directly from photos.</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card p-3">
                <FileText className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-medium text-foreground block">Rich Catalog Standards</span>
                  <span className="text-[11px] text-muted-foreground">Standard title, HTML description, Shopify taxonomy & tags.</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card p-3">
                <Layers className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-medium text-foreground block">Studio Perspectives</span>
                  <span className="text-[11px] text-muted-foreground">Renders 90° side, 45° hero angle, and macro textures.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State 2: Progress View */}
        {isGenerating && (
          <ProgressView
            generateAngles={modelSettings.generateAngles}
            textProvider={modelSettings.textProvider}
            imageProvider={modelSettings.imageProvider}
          />
        )}

        {/* State 3: Generated Result Review & Customization */}
        {enrichmentResult && editableFields && !isGenerating && (
          <div className="flex flex-col gap-4 py-2">
            {/* Vision Report Summary Banner */}
            <VisionReportCard analysis={enrichmentResult.analysis} />

            {/* Tabbed Review Panel */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details" className="text-xs">
                  Core Details
                </TabsTrigger>
                <TabsTrigger value="description" className="text-xs">
                  Description
                </TabsTrigger>
                <TabsTrigger value="seo" className="text-xs">
                  SEO & Meta
                </TabsTrigger>
                <TabsTrigger value="photography" className="text-xs">
                  Photos ({enrichmentResult.generatedImages.length})
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Core Details */}
              <TabsContent value="details">
                <DetailsTab
                  fields={editableFields}
                  collections={
                    collections.length > 0
                      ? collections
                      : (enrichmentResult.availableCollections as Collection[]) || []
                  }
                  onChange={(updater) =>
                    setEditableFields((prev) => (prev ? updater(prev) : prev))
                  }
                />
              </TabsContent>

              {/* Tab 2: Structured Description */}
              <TabsContent value="description">
                <DescriptionTab
                  descriptionHtml={editableFields.descriptionHtml}
                />
              </TabsContent>

              {/* Tab 3: SEO */}
              <TabsContent value="seo">
                <SeoTab
                  fields={editableFields}
                  onChange={(updater) =>
                    setEditableFields((prev) => (prev ? updater(prev) : prev))
                  }
                />
              </TabsContent>

              {/* Tab 4: Alternative Photography */}
              <TabsContent value="photography">
                <PhotosTab
                  images={enrichmentResult.generatedImages}
                  selectedUrls={selectedImageUrls}
                  onToggleUrl={handleToggleImage}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
          {!enrichmentResult ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleStartGeneration}
                disabled={isGenerating}
                className="gap-2"
              >
                <Sparkles className="size-4" />
                Start AI Vision Generation
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEnrichmentResult(null)}
                disabled={isApplying}
                className="gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                Regenerate
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={isApplying}
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={isApplying}
                  className="gap-2"
                >
                  {isApplying ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {onApplyInEditor ? "Apply to Editor" : "Apply & Save Product"}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
