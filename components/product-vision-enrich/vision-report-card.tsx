"use client";

import { Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VisionAnalysis } from "@/lib/validation/ai-vision-enrichment";

interface VisionReportCardProps {
  analysis: VisionAnalysis;
}

export function VisionReportCard({ analysis }: VisionReportCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <Camera className="size-3.5" /> Vision Intelligence Report
        </span>
        <span className="font-mono text-muted-foreground text-[11px]">
          {analysis.detectedAngles.join(", ") || "Standard angle detected"}
        </span>
      </div>
      <p className="font-medium text-foreground text-sm">
        {analysis.identifiedProduct}
      </p>
      <p className="text-muted-foreground leading-relaxed text-xs">
        {analysis.visualSummary}
      </p>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {analysis.materials.map((m) => (
          <Badge key={m} variant="secondary" className="text-[10px] py-0 font-normal">
            {m}
          </Badge>
        ))}
        {analysis.colors.map((c) => (
          <Badge key={c} variant="outline" className="text-[10px] py-0 font-normal">
            {c}
          </Badge>
        ))}
        {analysis.targetCategoryGuess && (
          <Badge variant="outline" className="text-[10px] py-0 font-normal border-primary/30 text-primary">
            Target: {analysis.targetCategoryGuess}
          </Badge>
        )}
      </div>
    </div>
  );
}
