"use client";

import { useState, useTransition, type ReactNode } from "react";
import { diffWords } from "diff";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { pushProduct, resolveConflictKeepShopify } from "@/app/(dashboard)/products/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useJobPolling } from "@/lib/hooks/use-job-polling";
import { sanitizeDescriptionHtml } from "@/lib/sanitize-description";
import { cn } from "@/lib/utils";
import type { ConflictSnapshot, Product, ProductStatus } from "@/types/product";

type VariantSnapshot = ConflictSnapshot["variants"][number];

function StatusPreview({ status }: { status: ProductStatus }) {
  if (status === "ACTIVE") {
    return <Badge className="border-transparent bg-success/10 text-success">Active</Badge>;
  }
  return <Badge className="border-transparent bg-warning/10 text-warning">Draft</Badge>;
}

// Unit 19 follow-up, per explicit user request ("something like git diff"):
// word-level highlighting inside a field, not just "this whole field
// differs." diffWords(shopifyText, appText) walks both strings once; each
// side then renders the same parts, skipping whichever half doesn't apply
// to it. Added (green, only in the app's text) and removed (red
// strikethrough, only in Shopify's text) mirror git diff's own convention —
// reuses --success/--destructive rather than inventing new colors, per
// ui-context.md's "never introduce a new color" rule.
function renderWordDiff(oldText: string, newText: string, side: "app" | "shopify"): ReactNode {
  const parts = diffWords(oldText, newText);
  return parts
    .filter((part) => (side === "app" ? !part.removed : !part.added))
    .map((part, index) => {
      const highlighted = side === "app" ? part.added : part.removed;
      if (!highlighted) {
        return <span key={index}>{part.value}</span>;
      }
      return side === "app" ? (
        <mark key={index} className="rounded bg-success/25 px-0.5 text-foreground">
          {part.value}
        </mark>
      ) : (
        <mark
          key={index}
          className="rounded bg-destructive/25 px-0.5 text-foreground line-through decoration-destructive"
        >
          {part.value}
        </mark>
      );
    });
}

// One labeled row of the diff. `differs` now only drives a thin left-border
// "changed" gutter (like a git diff's change bar) instead of washing the
// whole cell in --conflict — the word-level red/green highlighting inside
// does the actual "what changed" work, so the row-level marker just needs to
// say "look here," not compete with it for attention.
function DiffRow({
  label,
  app,
  shopify,
  differs,
}: {
  label: string;
  app: ReactNode;
  shopify: ReactNode;
  differs: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
      <div className={cn("flex flex-col gap-1 rounded-r-md py-1 pl-2", differs && "border-l-2 border-conflict")}>
        <p className="text-label font-medium text-muted-foreground">{label}</p>
        <div className="text-sm break-words whitespace-pre-wrap text-foreground">{app}</div>
      </div>
      <div className={cn("flex flex-col gap-1 rounded-r-md py-1 pl-2", differs && "border-l-2 border-conflict")}>
        <p className="text-label font-medium text-muted-foreground">{label}</p>
        <div className="text-sm break-words whitespace-pre-wrap text-foreground">{shopify}</div>
      </div>
    </div>
  );
}

// Shared by every plain-text field (title, price, tags, collection, SEO
// fields, description) — computes the word diff once and renders both
// sides, falling back to an em dash for a genuinely empty field rather than
// diffing against nothing.
function TextDiffRow({
  label,
  appText,
  shopifyText,
  mono = false,
}: {
  label: string;
  appText: string;
  shopifyText: string;
  mono?: boolean;
}) {
  const differs = appText !== shopifyText;
  const textClass = mono ? "font-mono text-table-data" : undefined;
  return (
    <DiffRow
      label={label}
      differs={differs}
      app={
        <span className={textClass}>
          {appText.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            renderWordDiff(shopifyText, appText, "app")
          )}
        </span>
      }
      shopify={
        <span className={textClass}>
          {shopifyText.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            renderWordDiff(shopifyText, appText, "shopify")
          )}
        </span>
      }
    />
  );
}

// Description is stored as sanitized HTML — diffing markup directly produces
// noisy, misleading results (a wrapping <p> change would swamp the real text
// change), so this strips it down to plain text first. Good enough for "what
// changed," not a substitute for the real rich-text editor.
function htmlToPlainText(html: string): string {
  return sanitizeDescriptionHtml(html)
    .replace(/<\/(p|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

type VariantDiffEntry =
  | { kind: "unchanged" | "changed"; app: VariantSnapshot; shopify: VariantSnapshot }
  | { kind: "added"; app: VariantSnapshot }
  | { kind: "removed"; shopify: VariantSnapshot };

// Variants are more like git diff's *lines* than its inline words — a
// variant either exists on both sides (unchanged/changed), only in the app
// (added), or only on Shopify (removed). Matched by shopifyVariantId, which
// both snapshots now carry (Unit 19) — a local-only draft variant has none,
// so it always shows as "added," which is exactly correct: it genuinely
// doesn't exist on Shopify yet.
function diffVariants(appVariants: VariantSnapshot[], shopifyVariants: VariantSnapshot[]): VariantDiffEntry[] {
  const shopifyById = new Map(
    shopifyVariants.filter((v) => v.shopifyVariantId).map((v) => [v.shopifyVariantId as string, v])
  );
  const matchedIds = new Set<string>();
  const entries: VariantDiffEntry[] = [];

  for (const app of appVariants) {
    const match = app.shopifyVariantId ? shopifyById.get(app.shopifyVariantId) : undefined;
    if (!match) {
      entries.push({ kind: "added", app });
      continue;
    }
    matchedIds.add(app.shopifyVariantId as string);
    const changed = match.optionName !== app.optionName || match.price !== app.price || match.inventory !== app.inventory;
    entries.push({ kind: changed ? "changed" : "unchanged", app, shopify: match });
  }
  for (const shopify of shopifyVariants) {
    if (shopify.shopifyVariantId && !matchedIds.has(shopify.shopifyVariantId)) {
      entries.push({ kind: "removed", shopify });
    }
  }
  return entries;
}

function variantLabel(variant: VariantSnapshot): string {
  return `${variant.optionName} — ${variant.price} — ${variant.inventory} in stock`;
}

// Unified (not two-column) since added/removed rows only exist on one side —
// the git-diff-style +/− convention reads more naturally here than forcing
// them into symmetric columns.
function VariantsDiff({
  appVariants,
  shopifyVariants,
}: {
  appVariants: VariantSnapshot[];
  shopifyVariants: VariantSnapshot[];
}) {
  const entries = diffVariants(appVariants, shopifyVariants);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No variants</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {entries.map((entry, index) => {
        if (entry.kind === "added") {
          return (
            <li
              key={index}
              className="rounded-r-md border-l-2 border-success bg-success/10 px-2 py-1 font-mono text-table-data text-foreground"
            >
              + {variantLabel(entry.app)}{" "}
              <span className="font-sans text-label text-muted-foreground">(only in yours)</span>
            </li>
          );
        }
        if (entry.kind === "removed") {
          return (
            <li
              key={index}
              className="rounded-r-md border-l-2 border-destructive bg-destructive/10 px-2 py-1 font-mono text-table-data text-foreground line-through decoration-destructive"
            >
              − {variantLabel(entry.shopify)}{" "}
              <span className="font-sans text-label text-muted-foreground no-underline">(only on Shopify)</span>
            </li>
          );
        }
        if (entry.kind === "changed") {
          return (
            <li
              key={index}
              className="flex flex-col gap-0.5 rounded-r-md border-l-2 border-conflict bg-conflict/10 px-2 py-1 font-mono text-table-data text-foreground"
            >
              <span>Yours: {variantLabel(entry.app)}</span>
              <span>Shopify: {variantLabel(entry.shopify)}</span>
            </li>
          );
        }
        return (
          <li key={index} className="px-2 py-1 font-mono text-table-data text-muted-foreground">
            {variantLabel(entry.app)}
          </li>
        );
      })}
    </ul>
  );
}

// Unit 19: shows conflictAppSnapshot/conflictShopifySnapshot side by side
// (app left, Shopify right, per ui-context.md's conflict resolution spec)
// and applies the owner's chosen resolution. Shared between the product
// list (components/product-table.tsx) and the product editor
// (components/product-form.tsx) — both just pass the conflicted `product`.
//
// Two resolution paths, deliberately asymmetric under the hood even though
// the UI presents them as equal choices:
// - "Keep Shopify version" is a pure local write (lib/db/products.ts's
//   resolveConflictKeepShopify) since conflictShopifySnapshot already has
//   everything needed — no Shopify call, no job, resolves synchronously.
// - "Keep app version" reuses the existing pushProduct/pushOneProduct job
//   path unchanged — the app's current record already IS the app's
//   snapshot, so "keep app" just means "push it," and markProductPushed
//   already clears the conflict fields on any successful push. This needs
//   its own useJobPolling instance, separate from any other polling loop in
//   the parent, matching the existing "don't cross-talk between flows"
//   precedent in components/product-table.tsx.
export function ConflictResolutionDialog({
  product,
  onOpenChange,
  onResolved,
}: {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  onResolved: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isKeepingShopify, startKeepShopify] = useTransition();
  const [isPushing, startPush] = useTransition();

  const { isPolling: isPushPolling, start: startPushPolling } = useJobPolling({
    onSettled: (status, results) => {
      if (status === "SUCCEEDED") {
        onResolved("Kept your app version and pushed it to Shopify");
      } else {
        const message = (results as { error?: string } | undefined)?.error ?? "Push failed";
        setError(message);
      }
    },
    onError: (message) => setError(message),
  });

  const appSnapshot = product?.conflictAppSnapshot ?? null;
  const shopifySnapshot = product?.conflictShopifySnapshot ?? null;
  const isBusy = isKeepingShopify || isPushing || isPushPolling;

  function handleKeepShopify() {
    if (!product) return;
    setError(null);
    startKeepShopify(async () => {
      const result = await resolveConflictKeepShopify(product.id);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      onResolved("Kept the Shopify version");
    });
  }

  function handleKeepApp() {
    if (!product) return;
    setError(null);
    startPush(async () => {
      const result = await pushProduct(product.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.message("Pushing your version to Shopify...");
      startPushPolling(result.jobId);
    });
  }

  return (
    <Dialog
      open={product !== null}
      onOpenChange={(open) => {
        if (!open && !isBusy) {
          setError(null);
          onOpenChange(false);
        }
      }}
    >
      {/* Set via inline style, not just a className max-w-* override — the
          shadcn DialogContent default (sm:max-w-lg) reads late enough in the
          generated stylesheet that a className override alone didn't
          reliably win on a real render, per explicit user feedback that the
          dialog stayed narrow. An inline style always wins over any class,
          regardless of stylesheet order, so this is the reliable fix. Scales
          with the viewport (min(...)) so it's wide on desktop without
          overflowing a small phone screen. */}
      <DialogContent style={{ width: "min(96vw, 60rem)", maxWidth: "min(96vw, 60rem)" }}>
        <DialogHeader>
          <DialogTitle>Resolve conflict: {product?.title}</DialogTitle>
          <DialogDescription>
            This product changed in Dockit and on Shopify at the same time. Choose which version to
            keep.{" "}
            <span className="text-success">Green</span> is only in your version,{" "}
            <span className="text-destructive line-through">red</span> is only on Shopify, and a{" "}
            <span className="border-l-2 border-conflict pl-1 text-conflict">purple bar</span> marks a
            field that differs.
          </DialogDescription>
        </DialogHeader>

        {appSnapshot && shopifySnapshot && (
          <div className="max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 pb-2">
              <p className="text-sm font-semibold text-foreground">Your version (Dockit)</p>
              <p className="text-sm font-semibold text-foreground">Shopify version</p>
            </div>
            <TextDiffRow label="Title" appText={appSnapshot.title} shopifyText={shopifySnapshot.title} />
            <TextDiffRow
              label="Description"
              appText={htmlToPlainText(appSnapshot.description ?? "")}
              shopifyText={htmlToPlainText(shopifySnapshot.description ?? "")}
            />
            <TextDiffRow label="Price" appText={appSnapshot.price} shopifyText={shopifySnapshot.price} mono />
            <DiffRow
              label="Status"
              app={<StatusPreview status={appSnapshot.status} />}
              shopify={<StatusPreview status={shopifySnapshot.status} />}
              differs={appSnapshot.status !== shopifySnapshot.status}
            />
            <TextDiffRow
              label="Tags"
              appText={appSnapshot.tags.join(", ")}
              shopifyText={shopifySnapshot.tags.join(", ")}
            />
            <TextDiffRow
              label="Collection"
              appText={appSnapshot.collectionTitle ?? ""}
              shopifyText={shopifySnapshot.collectionTitle ?? ""}
            />
            <TextDiffRow
              label="SEO title"
              appText={appSnapshot.seoTitle ?? ""}
              shopifyText={shopifySnapshot.seoTitle ?? ""}
            />
            <TextDiffRow
              label="SEO description"
              appText={appSnapshot.seoDescription ?? ""}
              shopifyText={shopifySnapshot.seoDescription ?? ""}
            />
            <div className="border-t border-border py-3">
              <p className="mb-2 text-label font-medium text-muted-foreground">Variants</p>
              <VariantsDiff appVariants={appSnapshot.variants} shopifyVariants={shopifySnapshot.variants} />
            </div>
          </div>
        )}

        {error && <p className="px-1 text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" disabled={isBusy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" disabled={isBusy} onClick={handleKeepShopify}>
            {isKeepingShopify ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Keeping Shopify version...
              </>
            ) : (
              "Keep Shopify version"
            )}
          </Button>
          <Button variant="outline" disabled={isBusy} onClick={handleKeepApp}>
            {isPushing || isPushPolling ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Pushing your version...
              </>
            ) : (
              "Keep app version & push"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
