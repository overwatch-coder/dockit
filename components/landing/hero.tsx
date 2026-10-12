"use client";

import Link from "next/link";
import { SignInButton, SignUpButton, Show } from "@clerk/nextjs";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-12 sm:pt-20 sm:pb-16 border-b border-border/80">
      <div className="mx-auto max-w-4xl px-6 text-center">
        {/* Subtle Mono Eyebrow */}
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
          Shopify Catalog Staging &bull; Deterministic Sync Guard
        </p>

        {/* Large Headline */}
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl leading-[1.08]">
          One Task <span className="text-primary">at a Time</span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg leading-relaxed">
          A dedicated staging workspace for Shopify merchants. Draft product changes locally, enrich SEO and standardized taxonomy with AI, and push live with deterministic two-way sync protection.
        </p>

        {/* Action CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Show when="signed-out">
            <SignUpButton forceRedirectUrl="/dashboard">
              <Button
                size="lg"
                className="h-10 px-5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm"
              >
                Get started free
                <ArrowRight className="ml-2 size-3.5" />
              </Button>
            </SignUpButton>
            <SignInButton forceRedirectUrl="/dashboard">
              <Button
                variant="outline"
                size="lg"
                className="h-10 px-5 text-xs font-medium border-border bg-surface hover:bg-card text-foreground"
              >
                Sign in
              </Button>
            </SignInButton>
            <Button
              nativeButton={false}
              variant="ghost"
              size="lg"
              className="h-10 px-4 text-xs font-medium text-muted-foreground hover:text-foreground"
              render={<a href="#showcase" />}
            >
              Explore live workspace
            </Button>
          </Show>
          <Show when="signed-in">
            <Button
              nativeButton={false}
              size="lg"
              className="h-10 px-5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm"
              render={<Link href="/dashboard" />}
            >
              Go to dashboard
              <ArrowRight className="ml-2 size-3.5" />
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              size="lg"
              className="h-10 px-4 text-xs font-medium border-border bg-surface hover:bg-card"
              render={<a href="#showcase" />}
            >
              Explore live workspace
            </Button>
          </Show>
        </div>

        {/* Technical Invariants Bar */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3 text-success shrink-0" /> GraphQL Admin API v2024
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3 text-success shrink-0" /> Zero live store overwrites
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3 text-success shrink-0" /> Rate-limit cost tracking
          </span>
        </div>
      </div>
    </section>
  );
}
