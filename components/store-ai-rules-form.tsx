"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Loader2,
  Package,
  RotateCcw,
  Save,
  Shirt,
  Sparkles,
  Store as StoreIcon,
  User,
  UserCheck,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_AI_RULES,
  type StoreAiRules,
} from "@/lib/ai/rules";
import type { PresentationStyle } from "@/lib/ai/contracts";
import { cn } from "@/lib/utils";
import {
  saveStoreAiRulesAction,
  resetStoreAiRulesAction,
} from "@/app/(dashboard)/settings/actions";

const PRESENTATION_OPTIONS: Array<{
  id: PresentationStyle;
  label: string;
  desc: string;
  icon: typeof Package;
}> = [
  {
    id: "product_only",
    label: "Product Only (Flat Lay / Studio)",
    desc: "Clean product photography without human models or mannequins on an isolated commercial background.",
    icon: Package,
  },
  {
    id: "on_model",
    label: "On-Model (Keep Face & Identity)",
    desc: "Human fashion model wearing the product. Strictly preserves facial features, expression, hairstyle, and identity.",
    icon: UserCheck,
  },
  {
    id: "ghost_mannequin",
    label: "3D Ghost / Invisible Mannequin",
    desc: "Dimensional hollow-body drape showing inside collar, neck lining, and natural shape without a visible model.",
    icon: Shirt,
  },
  {
    id: "studio_mannequin",
    label: "Studio Mannequin",
    desc: "Minimalist matte neutral retail tailor form or mannequin bust with subtle catalog drop shadows.",
    icon: User,
  },
];


export function StoreAiRulesForm({
  storeId,
  storeName,
  initialRules,
  isCustomizedInitial = false,
}: {
  storeId: string;
  storeName: string;
  initialRules: StoreAiRules;
  isCustomizedInitial?: boolean;
}) {
  const router = useRouter();
  const [rules, setRules] = useState<StoreAiRules>(initialRules);
  const [isCustomized, setIsCustomized] = useState(isCustomizedInitial);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "good" | "bad";
    text: string;
  } | null>(null);

  // Automatically dismiss the status notification after 4 seconds
  useEffect(() => {
    if (statusMessage) {
      const timer = window.setTimeout(() => {
        setStatusMessage(null);
      }, 4000);
      return () => window.clearTimeout(timer);
    }
  }, [statusMessage]);

  const isFormDirty =
    rules.brandTone !== initialRules.brandTone ||
    rules.titleRule !== initialRules.titleRule ||
    rules.descriptionRule !== initialRules.descriptionRule ||
    rules.tagsRule !== initialRules.tagsRule ||
    rules.seoRule !== initialRules.seoRule ||
    rules.customInstructions !== initialRules.customInstructions ||
    rules.presentationStyle !== initialRules.presentationStyle ||
    rules.modelFaceDirective !== initialRules.modelFaceDirective;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setSaving(true);

    try {
      const result = await saveStoreAiRulesAction({
        storeId,
        rules,
      });

      if (!result.success) {
        setStatusMessage({ tone: "bad", text: result.error });
        toast.error(result.error);
        return;
      }

      setRules(result.rules);
      setIsCustomized(true);
      setStatusMessage({
        tone: "good",
        text: "AI generation rules updated successfully! Future generations will follow your store rules.",
      });
      toast.success("AI rules saved for this store.");
      router.refresh();
    } catch {
      setStatusMessage({ tone: "bad", text: "Failed to save AI rules." });
      toast.error("Failed to save AI rules.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    setResetting(true);
    setStatusMessage(null);

    try {
      const result = await resetStoreAiRulesAction({ storeId });
      if (!result.success) {
        setStatusMessage({ tone: "bad", text: result.error });
        toast.error(result.error);
        return;
      }

      setRules(result.rules);
      setIsCustomized(false);
      setResetDialogOpen(false);
      setStatusMessage({
        tone: "good",
        text: "AI generation rules reset to standard system defaults.",
      });
      toast.success("AI rules reset to defaults.");
      router.refresh();
    } catch {
      setStatusMessage({ tone: "bad", text: "Failed to reset AI rules." });
      toast.error("Failed to reset AI rules.");
    } finally {
      setResetting(false);
    }
  };

  const handleFillDefaults = () => {
    setRules({ ...DEFAULT_AI_RULES });
    toast.info("Form filled with default rules. Click 'Save Rules' to persist.");
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <section
        className="flex flex-col gap-4 sm:gap-5 rounded-xl border bg-card p-3.5 shadow-sm sm:p-6"
        aria-label="AI Generation Rules"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3 sm:pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            <h3 className="text-sm sm:text-base font-semibold">AI Generation Rules</h3>
          </div>
          {isCustomized ? (
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/10 text-primary text-[11px] sm:text-xs"
            >
              Adapted Store Rules
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-muted-foreground/30 bg-muted text-muted-foreground text-[11px] sm:text-xs"
            >
              Standard Default Rules
            </Badge>
          )}
        </div>

        {/* Subheading with Store Scope */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground">
            <StoreIcon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Scoped to store: <strong className="text-foreground font-semibold">{storeName}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleFillDefaults}
              className="text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5 mr-1.5" />
              Fill Defaults in Form
            </Button>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-muted-foreground">
          Customize how AI generates titles, descriptions, tags, and SEO metadata for products in this store. Your adapted rules will override our default models and guidelines across single-product edits, bulk generations, and vision photo enrichments.
        </p>

        <form onSubmit={handleSave} className="flex flex-col gap-5 pt-2">
          {/* 1. Brand Tone & Persona */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="brand-tone" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Brand Voice & Merchandising Persona</span>
              <span className="text-[11px] font-normal text-muted-foreground">Tone & Style</span>
            </label>
            <Textarea
              id="brand-tone"
              rows={3}
              value={rules.brandTone}
              onChange={(e) => setRules({ ...rules, brandTone: e.target.value })}
              placeholder="e.g. World-class e-commerce copywriter, premium, technical, minimalist..."
              disabled={saving || resetting}
              className="text-xs sm:text-sm resize-y"
              required
            />
            <span className="text-[11px] text-muted-foreground">
              Directs the overall voice, vocabulary, and perspective adopted by the model.
            </span>
          </div>

          {/* 2. Product Title Rules */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="title-rule" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Product Title Format & Constraints</span>
              <span className="text-[11px] font-normal text-muted-foreground">Naming Standard</span>
            </label>
            <Textarea
              id="title-rule"
              rows={3}
              value={rules.titleRule}
              onChange={(e) => setRules({ ...rules, titleRule: e.target.value })}
              placeholder="e.g. [Brand] [Key Material/Feature] [Product Name] - [Variant/Specs]..."
              disabled={saving || resetting}
              className="text-xs sm:text-sm resize-y"
              required
            />
            <span className="text-[11px] text-muted-foreground">
              Rules for generating clean, high-converting product titles.
            </span>
          </div>

          {/* 3. Description Structure */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="description-rule" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Product Description Structure & HTML Rules</span>
              <span className="text-[11px] font-normal text-muted-foreground">HTML Formatting</span>
            </label>
            <Textarea
              id="description-rule"
              rows={4}
              value={rules.descriptionRule}
              onChange={(e) => setRules({ ...rules, descriptionRule: e.target.value })}
              placeholder="e.g. 1 narrative opening paragraph; bulleted list of 4-6 features with <strong> labels; care specs..."
              disabled={saving || resetting}
              className="text-xs sm:text-sm font-mono text-[12px] resize-y"
              required
            />
            <span className="text-[11px] text-muted-foreground">
              Defines semantic structure (paragraphs, bullet lists, bold labels). Note: Title headings and prices are automatically sanitized.
            </span>
          </div>

          {/* 4. Tags Rule */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tags-rule" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Tags & Search Keywords Rules</span>
              <span className="text-[11px] font-normal text-muted-foreground">Tag Standards</span>
            </label>
            <Textarea
              id="tags-rule"
              rows={2}
              value={rules.tagsRule}
              onChange={(e) => setRules({ ...rules, tagsRule: e.target.value })}
              placeholder="e.g. 6 to 12 relevant, search-friendly e-commerce tags in lowercase..."
              disabled={saving || resetting}
              className="text-xs sm:text-sm resize-y"
              required
            />
            <span className="text-[11px] text-muted-foreground">
              Directs how many and what types of tags are generated for store categorization and search.
            </span>
          </div>

          {/* 5. SEO Rule */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="seo-rule" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Google Snippet (SEO Title & Meta Description) Rules</span>
              <span className="text-[11px] font-normal text-muted-foreground">Search Engine Snippets</span>
            </label>
            <Textarea
              id="seo-rule"
              rows={2}
              value={rules.seoRule}
              onChange={(e) => setRules({ ...rules, seoRule: e.target.value })}
              placeholder="e.g. SEO Title: 50-65 chars; SEO Description: 140-160 chars high-CTR..."
              disabled={saving || resetting}
              className="text-xs sm:text-sm resize-y"
              required
            />
            <span className="text-[11px] text-muted-foreground">
              Character boundaries and persuasive styles for Google search snippets.
            </span>
          </div>

          {/* 6. Custom Store Constraints */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="custom-instructions" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Custom Store Constraints & Negative Guidelines</span>
              <span className="text-[11px] font-normal text-muted-foreground">Optional Store Rules</span>
            </label>
            <Textarea
              id="custom-instructions"
              rows={3}
              value={rules.customInstructions}
              onChange={(e) => setRules({ ...rules, customInstructions: e.target.value })}
              placeholder="e.g. Never mention competitors. Always highlight that products are made with 100% recycled cotton. Write in British English..."
              disabled={saving || resetting}
              className="text-xs sm:text-sm resize-y"
            />
            <span className="text-[11px] text-muted-foreground">
              Any unique rules, forbidden words, brand guidelines, or language requirements specific to this store.
            </span>
          </div>

          {/* 7. AI Image Generation & Model Face Presentation Mode */}
          <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 p-3.5 sm:p-4.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div className="flex items-center gap-2">
                <Wand2 className="size-4 text-primary" />
                <span className="text-xs sm:text-sm font-semibold text-foreground">
                  AI Image Generation Presentation & Model Face Consistency
                </span>
              </div>
              <span className="text-[11px] font-normal text-muted-foreground">Store Studio Default</span>
            </div>

            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Configure the default presentation style and model consistency guidelines for this store. Applies to on-demand generation, new angles, and catalog variant mockups.
            </p>

            {/* Presentation Mode Selection Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {PRESENTATION_OPTIONS.map((opt) => {
                const isSelected = (rules.presentationStyle || "product_only") === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRules({ ...rules, presentationStyle: opt.id })}
                    disabled={saving || resetting}
                    className={cn(
                      "flex flex-col text-left p-3 rounded-lg border transition-all text-xs",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                        : "border-border/60 bg-card hover:bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("size-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("font-medium text-xs", isSelected ? "text-foreground font-semibold" : "")}>
                          {opt.label}
                        </span>
                      </div>
                      {isSelected && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                          Default
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Model Face & Mannequin Consistency Directive */}
            <div className="flex flex-col gap-1.5 pt-2.5 border-t border-border/50">
              <label
                htmlFor="model-face-directive"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>Default Model Face & Mannequin Consistency Directive</span>
                <span className="text-[11px] font-normal text-muted-foreground">Model & Mannequin Rules</span>
              </label>
              <Textarea
                id="model-face-directive"
                rows={3}
                value={rules.modelFaceDirective ?? ""}
                onChange={(e) => setRules({ ...rules, modelFaceDirective: e.target.value })}
                placeholder="e.g. Always preserve the exact model face, facial structure, skin tone, and hairstyle from the reference photos across all variants. Use clean natural daylight studio lighting..."
                disabled={saving || resetting}
                className="text-xs sm:text-sm resize-y"
              />
              <span className="text-[11px] text-muted-foreground">
                Automatically injected into image generation prompts to enforce identity preservation, realistic skin tones, or hollow 3D invisible mannequin drape.
              </span>
            </div>
          </div>

          {/* Status Message */}

          {statusMessage && (
            <p
              role="status"
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                statusMessage.tone === "good"
                  ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {statusMessage.tone === "good" ? (
                <CheckCircle className="size-3.5 shrink-0" />
              ) : (
                <AlertCircle className="size-3.5 shrink-0" />
              )}
              {statusMessage.text}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button type="submit" size="sm" disabled={saving || resetting} className="w-full sm:w-auto text-xs sm:text-sm">
                {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                <Save className="size-3.5 mr-1.5" />
                Save Rules for {storeName}
              </Button>
            </div>

            {isCustomized && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResetDialogOpen(true)}
                disabled={saving || resetting}
                className="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                Reset to Standard Defaults
              </Button>
            )}
          </div>
        </form>
      </section>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset AI Rules to Defaults?</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset the AI generation rules for <strong>{storeName}</strong>? All custom prompt rules and constraints will be restored to the standard assigned defaults.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResetDialogOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleResetToDefaults}
              disabled={resetting}
            >
              {resetting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Confirm Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
