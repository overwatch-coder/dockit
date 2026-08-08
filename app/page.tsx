import { LandingHeader } from "@/components/landing/landing-header";
import { Hero } from "@/components/landing/hero";
import { FeatureCards } from "@/components/landing/feature-cards";
import { AppShowcase } from "@/components/landing/app-showcase";
import { LandingFooter } from "@/components/landing/footer";

const STEPS = [
  {
    step: "01",
    title: "Connect your Shopify Store",
    description: "Connect via secure Shopify OAuth in seconds — no manual API keys or tokens required.",
  },
  {
    step: "02",
    title: "Draft & Generate with AI",
    description: "Edit titles, variants, and generate SEO tags and product categories with one click.",
  },
  {
    step: "03",
    title: "Push or Sync with Conflict Guard",
    description: "Push changes to Shopify when ready, or pull store updates back with automatic conflict detection.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <LandingHeader />

      <main className="flex-1">
        <Hero />
        <FeatureCards />
        <AppShowcase />

        {/* How It Works Step Section */}
        <section id="how-it-works" className="border-t border-border py-20 bg-surface/20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                How Dockit Works
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-foreground-muted">
                Three simple steps to supercharge your Shopify product management workflow.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
              {STEPS.map(({ step, title, description }) => (
                <div
                  key={step}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-8 shadow-sm transition-all hover:border-primary/40"
                >
                  <span className="font-mono text-2xl font-extrabold text-primary">{step}</span>
                  <h3 className="text-lg font-bold text-foreground">{title}</h3>
                  <p className="text-sm text-foreground-muted leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
