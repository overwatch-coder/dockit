import React from "react";
import { Workflow, Target, ShieldCheck } from "lucide-react";

const FEATURES = [
  {
    icon: Workflow,
    title: "Integration ecosystem",
    description:
      "Seamless draft management, variant inventory control, and multi-store OAuth connections built directly for your Shopify workflow.",
    badge: "Draft First",
  },
  {
    icon: Target,
    title: "Goal setting and tracking",
    description:
      "Set catalog goals and generate high-impact SEO metadata, tags, and standardized Shopify product categories in seconds with AI assistance.",
    badge: "AI Powered",
  },
  {
    icon: ShieldCheck,
    title: "Secure data encryption",
    description:
      "Two-way store synchronization with automatic conflict detection that flags manual Shopify changes and guarantees data integrity.",
    badge: "Conflict Safe",
  },
];

export function FeatureCards() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Everything you need
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-foreground-muted">
            Engineered for high-volume store owners who need precision, AI speed, and total protection against sync conflicts.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description, badge }) => (
            <div
              key={title}
              className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary-subtle text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-6" />
                  </div>
                  <span className="inline-flex items-center rounded-full bg-surface border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground-muted">
                    {badge}
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-bold tracking-tight text-foreground">
                  {title}
                </h3>
                <p className="mt-3 text-sm text-foreground-muted leading-relaxed">
                  {description}
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-border/50 flex items-center text-xs font-semibold text-primary">
                <span>Explore capability</span>
                <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
