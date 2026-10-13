"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Filter React 19's false-positive warning for next-themes' intentional pre-hydration script tag
if (
  process.env.NODE_ENV === "development" &&
  typeof globalThis !== "undefined" &&
  !(globalThis as Record<string, unknown>).__nextThemesScriptWarningFiltered
) {
  (globalThis as Record<string, unknown>).__nextThemesScriptWarningFiltered = true;
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
