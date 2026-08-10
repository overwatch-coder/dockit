"use client";

import Link from "next/link";
import { SignInButton, SignUpButton, Show } from "@clerk/nextjs";
import { ArrowRight, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingBadge } from "@/components/landing/floating-badge";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
      <div className="relative mx-auto max-w-5xl px-6 text-center">
        {/* Top Tag Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1 text-xs font-medium text-primary shadow-sm">
          <Sparkles className="size-3.5 text-primary" />
          <span>Shopify Catalog Workspace</span>
          <span className="h-3 w-px bg-border" />
          <span className="text-foreground-muted font-normal">Draft & Sync Engine</span>
        </div>

        {/* Hero Content Container */}
        <div className="relative mt-8">
          {/*
            Badges are scoped to this headline-only wrapper (not the full
            content block) so they're vertically centered on the headline
            and never drift down over the subheadline on wide viewports.
          */}
          <div className="relative">
            <FloatingBadge variant="left-foreground" />
            <FloatingBadge variant="right-background" />

            {/* Large Headline — Solid Colors */}
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl md:text-7xl">
              One Task <span className="text-primary">at a Time</span>
            </h1>
          </div>

          {/* Subheadline / Descriptive text */}
          <p className="mx-auto mt-6 max-w-2xl text-base text-foreground-muted sm:text-lg md:text-xl leading-relaxed">
            Take complete control of your Shopify catalog. Edit products as local drafts, generate high-ranking SEO & tags with AI, and push live with total conflict protection.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Show when="signed-out">
              <SignUpButton forceRedirectUrl="/dashboard">
                <Button size="lg" className="h-12 px-7 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary-hover shadow-md transition-all">
                  Get started free
                  <ArrowRight className="ml-2 size-5" />
                </Button>
              </SignUpButton>
              <SignInButton forceRedirectUrl="/dashboard">
                <Button variant="outline" size="lg" className="h-12 px-7 text-base font-medium border-border bg-background hover:bg-surface">
                  Sign in
                </Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Button nativeButton={false} size="lg" className="h-12 px-7 text-base font-semibold" render={<Link href="/dashboard" />}>
                Go to dashboard
                <ArrowRight className="ml-2 size-5" />
              </Button>
            </Show>
          </div>

          {/* Trust bullet points */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-foreground-muted">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-success" /> Two-Way Sync Conflict Protection
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="size-4 text-warning" /> One-Click AI Category Resolution
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-4 text-primary" /> Multi-Tenant Store Switching
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
