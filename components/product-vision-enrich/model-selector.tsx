"use client";

import { useState } from "react";
import { Cpu, ChevronDown, ChevronUp, Sparkles, Layers, Image as ImageIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { TextVisionProviderName, ImageProviderName } from "@/lib/ai/contracts";

export interface ModelSelectorSettings {
  textProvider: TextVisionProviderName | "auto";
  imageProvider: ImageProviderName | "auto";
  generateAngles: boolean;
}

interface ModelSelectorProps {
  settings: ModelSelectorSettings;
  onChange: (updater: (prev: ModelSelectorSettings) => ModelSelectorSettings) => void;
}

const TEXT_PROVIDERS: Array<{
  id: TextVisionProviderName | "auto";
  label: string;
  badge: string;
  description: string;
}> = [
  {
    id: "auto",
    label: "Auto-detect",
    badge: "Smart",
    description: "Selects active key (Gemini → OpenAI)",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    badge: "Gemini 2.5 Flash",
    description: "Multimodal photo vision & Shopify taxonomy",
  },
  {
    id: "openai",
    label: "OpenAI",
    badge: "AI SDK / GPT-4o",
    description: "Vercel AI SDK structured generation",
  },
];

const IMAGE_PROVIDERS: Array<{
  id: ImageProviderName | "auto";
  label: string;
  badge: string;
  description: string;
}> = [
  {
    id: "auto",
    label: "Auto-detect",
    badge: "Smart",
    description: "Selects active key (Kie → Gemini → OpenAI)",
  },
  {
    id: "kie",
    label: "Kie.ai",
    badge: "Nano Banana Pro",
    description: "Commercial task-based studio rendering",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    badge: "Flash Image",
    description: "Reference photo ground-truth conditioning",
  },
  {
    id: "openai",
    label: "OpenAI DALL-E",
    badge: "DALL-E 3",
    description: "High-resolution photorealistic angles",
  },
];

export function ModelSelector({ settings, onChange }: ModelSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cpu className="size-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">AI Model & Engine Pipeline</span>
              <Badge variant="outline" className="text-[10px] py-0 font-normal">
                {settings.textProvider === "auto" ? "Auto Text/Vision" : settings.textProvider.toUpperCase()} •{" "}
                {settings.imageProvider === "auto" ? "Auto Images" : settings.imageProvider.toUpperCase()}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Configure text, vision, and image generation providers (OpenAI, Gemini, Kie.ai).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-1 text-xs text-primary hover:underline font-medium cursor-pointer"
        >
          <span>{isExpanded ? "Hide Engines" : "Configure"}</span>
          {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4 border-t border-border/50 pt-3">
          {/* Text & Vision Provider Choice */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3 text-primary" /> Text & Computer Vision Model
              </Label>
              <span className="text-[10px] font-mono text-muted-foreground">
                Catalog data & taxonomy
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TEXT_PROVIDERS.map((p) => {
                const isSelected = settings.textProvider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        textProvider: p.id,
                      }))
                    }
                    className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border/60 bg-muted/20 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{p.label}</span>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-normal">
                        {p.badge}
                      </Badge>
                    </div>
                    <span className="mt-1 text-[10px] text-muted-foreground leading-tight">
                      {p.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Perspective Image Generation Choice */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <ImageIcon className="size-3 text-primary" /> Perspective Photography Generator
              </Label>
              <span className="text-[10px] font-mono text-muted-foreground">
                Alternative angle rendering
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {IMAGE_PROVIDERS.map((p) => {
                const isSelected = settings.imageProvider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        imageProvider: p.id,
                      }))
                    }
                    className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border/60 bg-muted/20 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{p.label}</span>
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 font-normal">
                        {p.badge}
                      </Badge>
                    </div>
                    <span className="mt-1 text-[10px] text-muted-foreground leading-tight">
                      {p.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photography Toggle */}
          <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/10 p-2.5">
            <Checkbox
              id="gen-angles-toggle"
              checked={settings.generateAngles}
              onCheckedChange={(checked) =>
                onChange((prev) => ({
                  ...prev,
                  generateAngles: Boolean(checked),
                }))
              }
              className="mt-0.5"
            />
            <div className="flex flex-col">
              <Label
                htmlFor="gen-angles-toggle"
                className="text-xs font-medium text-foreground cursor-pointer flex items-center gap-1.5"
              >
                <Layers className="size-3 text-primary" /> Render studio angles (90° side, 45° hero, macro)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Uses the selected image model to render complementary studio shots using reference photography.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
