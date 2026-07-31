import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { PenLine, RefreshCw, Sparkles, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

// Minimal marketing landing page for signed-out visitors — a deliberate
// pivot from the earlier "just improve the sign-in screen" decision, per
// explicit user request. Kept restrained per ui-context.md's tokens/rules
// (no new colors, no gradients) even though the page's *content* is now
// marketing-shaped (hero/value-prop/how-it-works/footer) rather than the
// dashboard's utilitarian layout. See ui-context.md's "Public Landing Page"
// section for the scope note this required.
const VALUE_PROPS = [
  {
    icon: PenLine,
    title: "Draft first, publish on your terms",
    description: "Edit title, description, price, variants, and images as drafts before anything reaches Shopify.",
  },
  {
    icon: Sparkles,
    title: "AI-assisted SEO & tags",
    description: "Generate SEO fields, tags, and a suggested collection with one click — always editable before you save.",
  },
  {
    icon: RefreshCw,
    title: "Two-way sync, no surprises",
    description: "Pull changes made directly in Shopify back into the app, with conflicts flagged instead of silently overwritten.",
  },
  {
    icon: Store,
    title: "Built for more than one store",
    description: "One account, multiple connected stores — switch between them without losing context.",
  },
];

const STEPS = [
  { step: "1", title: "Connect your store", description: "Shopify OAuth — no manual API tokens to copy around." },
  { step: "2", title: "Edit as drafts", description: "Update products, variants, and SEO fields inside Dockit." },
  { step: "3", title: "Push or sync", description: "Push drafts to Shopify, or pull its changes back, whenever you're ready." },
];

function HeaderAuthControls() {
  return (
    <div className="flex items-center gap-3">
      <Show when="signed-out">
        <SignInButton>
          <Button variant="ghost">Sign in</Button>
        </SignInButton>
        <SignUpButton>
          <Button>Get started</Button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
        <Button nativeButton={false} render={<Link href="/dashboard" />}>
          Go to dashboard
        </Button>
      </Show>
      <ThemeToggle />
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background font-sans">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={28} height={28} className="rounded-[10px]" />
            <span className="text-section-heading font-semibold text-foreground">Dockit</span>
          </div>
          <HeaderAuthControls />
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Manage your Shopify products without living in Shopify admin
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            Draft product content, generate SEO and tags with AI, and push to Shopify on your
            schedule — with changes made directly in Shopify synced back and conflicts flagged,
            never silently overwritten.
          </p>
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignUpButton>
                <Button size="lg">Get started</Button>
              </SignUpButton>
              <SignInButton>
                <Button variant="outline" size="lg">
                  Sign in
                </Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Button nativeButton={false} size="lg" render={<Link href="/dashboard" />}>
                Go to dashboard
              </Button>
            </Show>
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_PROPS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex flex-col gap-3">
                <Icon className="size-5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-section-heading font-semibold text-foreground">How it works</h2>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map(({ step, title, description }) => (
              <div key={step} className="flex flex-col gap-2">
                <span className="text-sm font-mono text-primary">{step}</span>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Dockit</span>
          <span>A product dashboard for Shopify store owners</span>
        </div>
      </footer>
    </div>
  );
}
