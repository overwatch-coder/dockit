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
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#app-showcase", label: "App Showcase" },
];

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <Image
              src="/logo.svg"
              alt="Dockit Logo"
              width={30}
              height={30}
              className="rounded-lg shadow-sm"
            />
            <span className="text-lg font-bold tracking-tight text-foreground">Dockit</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
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
              <Button variant="ghost" size="sm" className="font-medium">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton forceRedirectUrl="/dashboard">
              <Button size="sm" className="bg-primary font-medium text-primary-foreground hover:bg-primary-hover shadow-sm">
                Get started
              </Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
            <Button nativeButton={false} size="sm" render={<Link href="/dashboard" />}>
              Go to dashboard
            </Button>
          </Show>
          <ThemeToggle />
        </div>

        {/* Mobile actions: theme toggle + hamburger menu */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="gap-6 p-6">
              <SheetHeader className="p-0">
                <SheetTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight text-foreground">
                  <Image src="/logo.svg" alt="Dockit Logo" width={26} height={26} className="rounded-lg shadow-sm" />
                  Dockit
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col gap-1 text-base font-medium text-foreground">
                {NAV_LINKS.map(({ href, label }) => (
                  <SheetClose
                    key={href}
                    render={<a href={href} className="rounded-md px-3 py-2.5 transition-colors hover:bg-surface" />}
                  >
                    {label}
                  </SheetClose>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
                <Show when="signed-out">
                  <SignUpButton forceRedirectUrl="/dashboard">
                    <Button className="w-full bg-primary font-medium text-primary-foreground hover:bg-primary-hover shadow-sm">
                      Get started
                    </Button>
                  </SignUpButton>
                  <SignInButton forceRedirectUrl="/dashboard">
                    <Button variant="outline" className="w-full font-medium">
                      Sign in
                    </Button>
                  </SignInButton>
                </Show>
                <Show when="signed-in">
                  <div className="flex items-center gap-3 px-1 pb-1">
                    <UserButton />
                    <span className="text-sm text-foreground-muted">Signed in</span>
                  </div>
                  <Button nativeButton={false} className="w-full" render={<Link href="/dashboard" />}>
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
