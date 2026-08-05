"use client";

// Next.js 16.3: the root-level catch-all — only fires for an error above
// app/(dashboard)/error.tsx's boundary (the root layout itself, or the
// public marketing page at app/page.tsx). Must define its own <html>/<body>
// since it replaces the root layout when active; can't reuse the design
// system's usual providers/fonts (ThemeProvider, Clerk) since those are
// exactly what may have failed. Kept intentionally plain — inline styles
// only, no Tailwind classes — since this is the true last-resort fallback
// and shouldn't depend on any app infrastructure working.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h2>
        <p style={{ color: "#71717a", maxWidth: "28rem" }}>
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={() => retry()}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "8px",
            background: "#5B5FEF",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
