import { LandingHeader } from "@/components/landing/landing-header";
import { Hero } from "@/components/landing/hero";
import { AppShowcase } from "@/components/landing/app-showcase";
import { FeatureCards } from "@/components/landing/feature-cards";
import { LandingFooter } from "@/components/landing/footer";
import { ArrowRight, KeyRound, Sparkles, ShieldCheck } from "lucide-react";

const STEPS = [
  {
    step: "01",
    icon: KeyRound,
    title: "Authorize Shopify Store",
    subtitle: "Shopify OAuth 2.0 handshake",
    description: "Connect your store in seconds with zero manual API tokens or custom app keys. Multi-tenant token encryption at rest.",
  },
  {
    step: "02",
    icon: Sparkles,
    title: "Draft & Generate with AI",
    subtitle: "Local staging & enrichment",
    description: "Stage titles, variants, and pricing locally. Resolve standardized Shopify taxonomy categories and SEO metadata with one click.",
  },
  {
    step: "03",
    icon: ShieldCheck,
    title: "Push or Sync with Conflict Guard",
    subtitle: "Deterministic GraphQL batching",
    description: "Publish staged drafts in rate-limit resilient batches, or pull store updates back with deterministic two-way conflict diffing.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Framed Container */}
      <div className="mx-auto max-w-6xl border-x border-border/80 min-h-screen flex flex-col bg-background">
        <LandingHeader />

        <main className="flex-1">
          {/* 1. Hero Section */}
          <Hero />

          {/* 2. Live Desktop Workspace Showcase */}
          <AppShowcase />

          {/* 3. Core Architecture Bento Grid */}
          <FeatureCards />

          {/* 4. Sequential Architecture Pipeline */}
          <section id="how-it-works" className="py-16 md:py-24 border-b border-border/80 bg-surface/30">
            <div className="px-6">
              <div className="max-w-2xl mb-12">
                <span className="font-mono text-xs uppercase tracking-widest text-primary font-medium">
                  Operational Flow
                </span>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  How Dockit Works
                </h2>
                <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  A closed, deterministic loop designed to keep your live Shopify catalog protected from accidental mutations.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {STEPS.map(({ step, icon: Icon, title, subtitle, description }, idx) => (
                  <div
                    key={step}
                    className="relative flex flex-col justify-between rounded-xl border border-border bg-surface p-6 transition-colors hover:border-border/80"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-4 border-b border-border/60">
                        <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-foreground font-mono text-xs">
                          {step}
                        </span>
                        <Icon className="size-4 text-muted-foreground" />
                      </div>

                      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
                      <p className="mt-0.5 font-mono text-[10px] uppercase text-primary tracking-wider">{subtitle}</p>
                      <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
                    </div>

                    {idx < STEPS.length - 1 && (
                      <div className="hidden md:flex items-center gap-1.5 mt-5 pt-3 border-t border-border/60 text-[10px] font-mono text-muted-foreground">
                        <span>Passes to next phase</span>
                        <ArrowRight className="size-3" />
                      </div>
                    )}
                    {idx === STEPS.length - 1 && (
                      <div className="hidden md:flex items-center gap-1.5 mt-5 pt-3 border-t border-border/60 text-[10px] font-mono text-success">
                        <span>Live Storefront Synchronized</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

        {/* 5. Footer */}
        <LandingFooter />
      </div>
    </div>
  );
}
