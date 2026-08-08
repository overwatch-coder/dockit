"use client";

import Image from "next/image";
import Link from "next/link";
import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
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
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How It Works
            </a>
            <a href="#app-showcase" className="transition-colors hover:text-foreground">
              App Showcase
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
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
      </div>
    </header>
  );
}
