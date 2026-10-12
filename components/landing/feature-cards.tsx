"use client";

import React from "react";
import { GitCompare, Layers, Sparkles, Activity } from "lucide-react";

export function FeatureCards() {
  return (
    <section id="capabilities" className="py-16 md:py-24 border-b border-border/80">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl mb-12">
          <span className="font-mono text-xs uppercase tracking-widest text-primary font-medium">
            Core Architecture
          </span>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Engineered for high-volume catalog integrity
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Eliminate premature storefront publishing, sync collisions, and chaotic category taxonomies with a dedicated operator workspace.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bento Item 1: Wide Card (Span 2) - Integration ecosystem */}
          <div className="md:col-span-2 rounded-xl border border-border bg-surface p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-primary">
                    <Layers className="size-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">
                    Integration ecosystem &amp; Draft Sandbox
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground uppercase">01 / STAGING</span>
              </div>

              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                Stage complete catalog overhauls — title, description, variant matrix, imagery, and collections — in an isolated database before publishing a single byte to Shopify.
              </p>

              {/* Mini UI Snippet */}
              <div className="mt-5 rounded-lg border border-border bg-card p-3 font-mono text-[11px]">
                <div className="flex items-center justify-between border-b border-border pb-2 text-muted-foreground text-[10px]">
                  <span>VARIANT MATRIX</span>
                  <span className="text-success">DRAFT STATE PERSISTED</span>
                </div>
                <div className="mt-2 space-y-1.5 text-foreground">
                  <div className="flex items-center justify-between">
                    <span>SKU: LTH-BP-BLK-S (Black / Small)</span>
                    <span className="text-muted-foreground">$120.00 &bull; 20 units</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>SKU: LTH-BP-BLK-M (Black / Medium)</span>
                    <span className="text-muted-foreground">$120.00 &bull; 25 units</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-border/60 flex items-center gap-4 text-[11px] font-mono text-muted-foreground">
              <span>&bull; Vercel Blob draft images</span>
              <span>&bull; Multi-store OAuth scoping</span>
            </div>
          </div>

          {/* Bento Item 2: Standard Card (Span 1) - Conflict Guard */}
          <div className="rounded-xl border border-border bg-surface p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-conflict">
                    <GitCompare className="size-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">
                    Deterministic Conflict Guard
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground uppercase">02 / DIFF</span>
              </div>

              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                Never overwrite Shopify edits made by other staff. Two-way timestamp tracking isolates divergent fields and triggers field-by-field diff resolution.
              </p>

              {/* Mini Diff Preview */}
              <div className="mt-5 rounded-lg border border-border bg-card p-3 font-mono text-[10px] space-y-1.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>LAST SYNC</span>
                  <span>10:00:00 UTC</span>
                </div>
                <div className="flex items-center justify-between text-primary">
                  <span>APP DRAFT</span>
                  <span>10:14:22 UTC (+14m)</span>
                </div>
                <div className="flex items-center justify-between text-conflict">
                  <span>SHOPIFY ADMIN</span>
                  <span>10:22:05 UTC (+22m)</span>
                </div>
                <div className="pt-1 border-t border-border text-[9px] text-conflict font-bold uppercase">
                  &bull; Mutation Blocked &bull; Diff Flagged
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-border/60 text-[11px] font-mono text-muted-foreground">
              <span>&bull; Snapshot persistence in Postgres</span>
            </div>
          </div>

          {/* Bento Item 3: Standard Card (Span 1) - Taxonomy */}
          <div className="rounded-xl border border-border bg-surface p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-primary">
                    <Sparkles className="size-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">
                    Shopify Taxonomy Resolution
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground uppercase">03 / AI</span>
              </div>

              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                Model queries are matched server-side against Shopify&apos;s real 10,000+ category taxonomy tree, preventing hallucinated tags and malformed catalog mappings.
              </p>

              {/* Category Tree Snippet */}
              <div className="mt-5 rounded-lg border border-border bg-card p-3 font-mono text-[10px] space-y-1 text-muted-foreground">
                <p>Apparel &amp; Accessories</p>
                <p className="pl-2">&rarr; Handbags, Wallets &amp; Cases</p>
                <p className="pl-4 text-primary font-medium">&rarr; Backpacks (Standardized)</p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-border/60 text-[11px] font-mono text-muted-foreground">
              <span>&bull; Server-side search cache</span>
            </div>
          </div>

          {/* Bento Item 4: Wide Card (Span 2) - Rate Limit Engine */}
          <div className="md:col-span-2 rounded-xl border border-border bg-surface p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-success">
                    <Activity className="size-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">
                    Rate-Limit Aware GraphQL Batching
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground uppercase">04 / PIPELINE</span>
              </div>

              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                Shopify strictly meters GraphQL API requests with cost-bucket limits. Dockit monitors <code className="font-mono text-foreground">throttleStatus</code> headers and automatically executes jittered backoff, ensuring zero dropped sync operations.
              </p>

              {/* Cost Meter Snippet */}
              <div className="mt-5 rounded-lg border border-border bg-card p-3 font-mono text-[10px]">
                <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                  <span>THROTTLE STATUS</span>
                  <span className="text-success font-semibold">RESTORE RATE: 50 PTS / SEC</span>
                </div>
                <div className="w-full bg-surface rounded-full h-2 border border-border overflow-hidden">
                  <div className="bg-success h-full rounded-full" style={{ width: "95%" }} />
                </div>
                <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground">
                  <span>Capacity: 950 / 1000 pts</span>
                  <span>Batch status: Nominal</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-border/60 flex items-center gap-4 text-[11px] font-mono text-muted-foreground">
              <span>&bull; Capped exponential backoff</span>
              <span>&bull; Granular per-item failure reporting</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
