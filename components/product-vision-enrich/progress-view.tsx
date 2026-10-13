"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, CheckCircle2, Clock } from "lucide-react";
import type { TextVisionProviderName, ImageProviderName } from "@/lib/ai/contracts";

interface ProgressViewProps {
  generateAngles: boolean;
  textProvider: TextVisionProviderName | "auto";
  imageProvider: ImageProviderName | "auto";
}

export function ProgressView({
  generateAngles,
  textProvider,
  imageProvider,
}: ProgressViewProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const textLabel =
    textProvider === "openai"
      ? "OpenAI GPT-4o Mini"
      : textProvider === "gemini"
        ? "Google Gemini 2.5 Flash"
        : "Multimodal Vision Engine (Auto)";

  const imageLabel =
    imageProvider === "kie"
      ? "Kie.ai (Nano Banana Pro)"
      : imageProvider === "openai"
        ? "OpenAI DALL-E 3"
        : imageProvider === "gemini"
          ? "Google Gemini Flash Image"
          : "Perspective Studio Engine (Auto)";

  // Dynamic stage transitions based on elapsed time
  // Step 1: 0 - 3s
  // Step 2: 4 - 7s
  // Step 3: 8s+
  const step1Done = elapsed >= 4;
  const step2Done = elapsed >= 8;

  const currentPercent = !generateAngles
    ? Math.min(15 + elapsed * 18, 95)
    : Math.min(
        elapsed < 4
          ? 15 + elapsed * 6
          : elapsed < 8
            ? 40 + (elapsed - 4) * 8
            : 72 + Math.min((elapsed - 8) * 3, 23),
        95
      );

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
      <div className="relative flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary animate-pulse">
        <Sparkles className="size-8 animate-spin" />
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {elapsed}s
        </span>
      </div>

      <div className="flex flex-col gap-1.5 max-w-sm">
        <h3 className="text-base font-semibold text-foreground">
          Analyzing Imagery & Synthesizing Catalog Data
        </h3>
        <p className="text-xs text-muted-foreground">
          Multithreaded AI pipeline active: vision scanning, rich metadata synthesis, and perspective studio rendering.
        </p>
      </div>

      {/* Animated Live Progress Bar */}
      <div className="w-full max-w-md space-y-1.5">
        <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
          <span>Synthesizing product...</span>
          <span className="text-primary font-semibold">{Math.round(currentPercent)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60 border border-border/50">
          <div
            className="h-full bg-primary transition-all duration-700 ease-out"
            style={{ width: `${currentPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <span>Active timer: {elapsed}s elapsed</span>
          <span className="text-primary/90 flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-primary animate-ping" />
            Parallel execution
          </span>
        </div>
      </div>

      {/* Live Stage Checklist */}
      <div className="flex flex-col gap-2 w-full max-w-md text-xs font-mono">
        {/* Step 1 */}
        <div
          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
            step1Done
              ? "border-emerald-500/30 bg-emerald-500/10 text-foreground"
              : "border-primary/40 bg-primary/5 text-foreground shadow-sm"
          }`}
        >
          {step1Done ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
          ) : (
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          )}
          <div className="flex-1">
            <span className={step1Done ? "text-emerald-700 dark:text-emerald-300" : "font-medium text-primary"}>
              {textLabel} scanning product photography
            </span>
          </div>
          {step1Done && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Done</span>}
        </div>

        {/* Step 2 */}
        <div
          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
            step2Done
              ? "border-emerald-500/30 bg-emerald-500/10 text-foreground"
              : step1Done
                ? "border-primary/40 bg-primary/5 text-foreground shadow-sm"
                : "border-border/40 bg-muted/20 text-muted-foreground"
          }`}
        >
          {step2Done ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
          ) : step1Done ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          ) : (
            <Clock className="size-4 shrink-0 text-muted-foreground/60" />
          )}
          <div className="flex-1">
            <span
              className={
                step2Done
                  ? "text-emerald-700 dark:text-emerald-300"
                  : step1Done
                    ? "font-medium text-primary"
                    : "text-muted-foreground"
              }
            >
              Structuring copy, Shopify taxonomy & matching collection
            </span>
          </div>
          {step2Done && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Done</span>}
        </div>

        {/* Step 3 (Optional) */}
        {generateAngles && (
          <div
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
              step2Done
                ? "border-primary/40 bg-primary/5 text-foreground shadow-sm"
                : "border-border/40 bg-muted/20 text-muted-foreground"
            }`}
          >
            {step2Done ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            ) : (
              <Clock className="size-4 shrink-0 text-muted-foreground/60" />
            )}
            <div className="flex-1">
              <span className={step2Done ? "font-medium text-primary" : "text-muted-foreground"}>
                {imageLabel} rendering 3 studio angles in parallel
              </span>
            </div>
            {step2Done && (
              <span className="text-[10px] text-primary font-semibold animate-pulse">Rendering…</span>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground max-w-md">
        💡 Rendering studio angles runs in parallel for faster results. This takes approximately 10–18 seconds.
      </p>
    </div>
  );
}
