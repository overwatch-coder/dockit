"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = [
  { href: "#capabilities", label: "Capabilities" },
  { href: "#showcase", label: "Live Workspace" },
  { href: "#how-it-works", label: "How It Works" },
];

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between border-x border-border/80 px-6 py-3.5">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <Image
              src="/logo.svg"
              alt="Dockit Logo"
              width={26}
              height={26}
              className="rounded-md"
            />
            <span className="text-base font-semibold tracking-tight text-foreground">Dockit</span>
            <span className="hidden font-mono text-[10px] uppercase text-muted-foreground sm:inline-block border border-border px-1.5 py-0.5 rounded">
              Shopify Staging
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-xs font-medium text-muted-foreground md:flex">
            {NAV_LINKS.map(({ href, label }) => (
              <a key={href} href={href} className="transition-colors hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 md:flex">
          <Show when="signed-out">
            <SignInButton forceRedirectUrl="/dashboard">
              <Button variant="ghost" size="sm" className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton forceRedirectUrl="/dashboard">
              <Button size="sm" className="h-8 px-3.5 bg-primary text-xs font-medium text-primary-foreground hover:bg-primary-hover shadow-sm">
                Get started
              </Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
            <Button nativeButton={false} size="sm" className="h-8 px-3.5 text-xs font-medium" render={<Link href="/dashboard" />}>
              Go to dashboard
            </Button>
          </Show>
          <ThemeToggle />
        </div>

        {/* Mobile actions: theme toggle + hamburger menu */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" className="size-8" />}>
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="right" className="gap-6 p-6">
              <SheetHeader className="p-0">
                <SheetTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight text-foreground">
                  <Image src="/logo.svg" alt="Dockit Logo" width={24} height={24} className="rounded-md" />
                  Dockit
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col gap-1 text-sm font-medium text-foreground">
                {NAV_LINKS.map(({ href, label }) => (
                  <SheetClose
                    key={href}
                    render={<a href={href} className="rounded-md px-3 py-2 transition-colors hover:bg-surface" />}
                  >
                    {label}
                  </SheetClose>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
                <Show when="signed-out">
                  <SignUpButton forceRedirectUrl="/dashboard">
                    <Button className="w-full bg-primary text-xs font-medium text-primary-foreground hover:bg-primary-hover shadow-sm">
                      Get started
                    </Button>
                  </SignUpButton>
                  <SignInButton forceRedirectUrl="/dashboard">
                    <Button variant="outline" className="w-full text-xs font-medium">
                      Sign in
                    </Button>
                  </SignInButton>
                </Show>
                <Show when="signed-in">
                  <div className="flex items-center gap-3 px-1 pb-1">
                    <UserButton />
                    <span className="text-xs text-muted-foreground">Signed in</span>
                  </div>
                  <Button nativeButton={false} className="w-full text-xs" render={<Link href="/dashboard" />}>
                    Go to dashboard
                  </Button>
                </Show>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
