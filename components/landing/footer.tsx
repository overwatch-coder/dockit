"use client";

import Image from "next/image";
import Link from "next/link";
import { SignUpButton, Show } from "@clerk/nextjs";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingFooter() {
  return (
    <footer className="relative overflow-hidden bg-background pt-20">
      {/* Sphere / Rising Sun Horizon Container */}
      <div className="relative mx-auto max-w-6xl px-6 pb-20 text-center">
        {/* Curved Oval Sphere Dome Background with Horizon Glow */}
        <div
          className="absolute left-1/2 top-0 -z-10 h-[380px] w-[180%] sm:w-[140%] md:w-[120%] -translate-x-1/2 rounded-t-[100%] border-t-2 border-primary/40 bg-surface shadow-[0_-25px_60px_rgba(91,95,239,0.12)]"
          aria-hidden="true"
        />

        {/* Rising Sun Horizon Content */}
        <div className="relative z-10 mx-auto max-w-2xl pt-12">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> Start Managing Smarter Today
          </div>

          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Ready to transform your Shopify workflow?
          </h2>

          <p className="mt-4 text-sm text-foreground-muted sm:text-base leading-relaxed">
            Take complete control of your products, AI tags, and store synchronization with zero conflict risk.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Show when="signed-out">
              <SignUpButton forceRedirectUrl="/dashboard">
                <Button size="lg" className="h-11 px-6 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary-hover shadow-md">
                  Get started free
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Button nativeButton={false} size="lg" className="h-11 px-6 text-sm font-semibold" render={<Link href="/dashboard" />}>
                Go to dashboard
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </Show>
          </div>
        </div>
      </div>

      {/* Footer Navigation Bar */}
      <div className="border-t border-border bg-background py-8 text-xs text-foreground-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="Dockit" width={22} height={22} className="rounded-md" />
            <span className="font-bold text-foreground">Dockit</span>
            <span className="text-border">|</span>
            <span>Shopify Catalog Workspace</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-medium">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How It Works
            </a>
            <a href="#app-showcase" className="transition-colors hover:text-foreground">
              App Showcase
            </a>
            <Link href="/dashboard" className="transition-colors hover:text-foreground">
              Dashboard
            </Link>
          </div>

          <div>
            © {new Date().getFullYear()} Dockit. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
