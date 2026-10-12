"use client";

import Image from "next/image";
import Link from "next/link";
import { SignUpButton, Show } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingFooter() {
  return (
    <footer className="bg-surface/30">
      <div className="px-6 py-20 text-center">
        <div className="mx-auto max-w-xl">
          <span className="font-mono text-xs uppercase tracking-widest text-primary font-medium">
            Production Ready
          </span>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Ready to take control of your catalog?
          </h2>

          <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Stage changes offline, generate structured SEO metadata, and push live with deterministic conflict diffing.
          </p>

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
            </Show>
          </div>
        </div>
      </div>

      {/* Footer Navigation Bar */}
      <div className="border-t border-border/80 bg-background/50 py-6 text-xs text-muted-foreground px-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="Dockit" width={18} height={18} className="rounded" />
            <span className="font-semibold text-foreground">Dockit</span>
            <span className="text-border">/</span>
            <span>Shopify Staging Workspace</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-medium text-xs">
            <a href="#capabilities" className="transition-colors hover:text-foreground">
              Capabilities
            </a>
            <a href="#showcase" className="transition-colors hover:text-foreground">
              Live Workspace
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How It Works
            </a>
            <Link href="/dashboard" className="transition-colors hover:text-foreground">
              Dashboard
            </Link>
          </div>

          <div className="font-mono text-[11px]">
            &copy; {new Date().getFullYear()} Dockit. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
