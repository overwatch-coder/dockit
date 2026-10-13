"use client";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface DescriptionTabProps {
  descriptionHtml: string;
}

export function DescriptionTab({ descriptionHtml }: DescriptionTabProps) {
  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Structured Product Description (HTML Preview)</Label>
        <Badge variant="outline" className="text-[10px] text-success border-success/30">
          Compliant e-commerce standard
        </Badge>
      </div>
      <div
        className="max-h-64 overflow-y-auto rounded-lg border border-border/80 bg-background p-4 text-xs leading-relaxed text-foreground [&>p]:mb-3 [&>ul]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:mb-1 [&>strong]:text-foreground"
        dangerouslySetInnerHTML={{ __html: descriptionHtml }}
      />
    </div>
  );
}
