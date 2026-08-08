import React from "react";
import { Layers, Zap, Hexagon, Shield, Orbit, Sparkles } from "lucide-react";

const BRAND_LOGOS = [
  { name: "Acme Corp", icon: Layers },
  { name: "Quantum", icon: Zap },
  { name: "Echo Valley", icon: Hexagon },
  { name: "PULSE", icon: Shield },
  { name: "APEX", icon: Orbit },
  { name: "Celestial", icon: Sparkles },
];

export function BrandLogos() {
  return (
    <section className="border-y border-border/70 bg-surface/50 py-12 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Trusted by the world's most innovative teams
        </p>

        <div className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-6 items-center justify-items-center opacity-80 transition-opacity hover:opacity-100">
          {BRAND_LOGOS.map(({ name, icon: Icon }) => (
            <div
              key={name}
              className="group flex items-center gap-2 text-foreground-muted transition-colors hover:text-foreground"
            >
              <Icon className="size-5 transition-transform duration-300 group-hover:scale-110 text-primary/80" />
              <span className="text-sm font-bold tracking-tight">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
