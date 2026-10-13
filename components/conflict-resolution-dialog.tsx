"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { diffWords } from "diff";
import { Loader2 } from "lucide-react";
import { resolveConflictWithSelections } from "@/app/(dashboard)/products/actions";
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
import type { ConflictFieldSelections } from "@/lib/db/products";
import type { ConflictSnapshot, Product, ProductStatus } from "@/types/product";

type VariantSnapshot = ConflictSnapshot["variants"][number];
type Side = "app" | "shopify";
type FieldKey = keyof ConflictFieldSelections;

const FIELD_KEYS: FieldKey[] = [
  "title",
  "description",
  "price",
  "status",
  "tags",
  "collection",
  "category",
  "seoTitle",
  "seoDescription",
  "variants",
];

function StatusPreview({ status }: { status: ProductStatus }) {
  if (status === "ACTIVE") {
    return <Badge className="border-transparent bg-success/10 text-success">Active</Badge>;
  }
  return <Badge className="border-transparent bg-warning/10 text-warning">Draft</Badge>;
}

// Word-level highlighting inside a field using git diff conventions:
// diffWords(shopifyText, appText) walks both strings once; each
// side then renders the corresponding added or removed parts.
function renderWordDiff(oldText: string, newText: string, side: Side): ReactNode {
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

// Per explicit user request: a tiny two-way toggle so each differing field
// can be individually kept from either side, instead of only choosing one
// side for the whole product. Rendered above a row's two columns, only when
// that row actually differs — a field with nothing to choose between gets
// no picker.
function FieldPicker({ value, onChange }: { value: Side; onChange: (value: Side) => void }) {
  return (
    <div className="mb-1.5 flex justify-end gap-1">
      <button
        type="button"
        onClick={() => onChange("app")}
        className={cn(
          "rounded px-1.5 py-0.5 text-label font-medium",
          value === "app" ? "bg-primary-subtle text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        Use mine
      </button>
      <button
        type="button"
        onClick={() => onChange("shopify")}
        className={cn(
          "rounded px-1.5 py-0.5 text-label font-medium",
          value === "shopify" ? "bg-primary-subtle text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        Use Shopify's
      </button>
    </div>
  );
}

// One labeled row of the diff. `differs` drives a thin left-border "changed"
// gutter (like a git diff's change bar) instead of washing the whole cell in
// --conflict — the word-level red/green highlighting inside does the actual
// "what changed" work, so the row-level marker just needs to say "look
// here." `picker`, when present, renders above the two columns.
function DiffRow({
  label,
  app,
  shopify,
  differs,
  picker,
}: {
  label: string;
  app: ReactNode;
  shopify: ReactNode;
  differs: boolean;
  picker?: ReactNode;
}) {
  return (
    <div className="border-t border-border py-3 first:border-t-0 first:pt-0">
      {picker}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <div className={cn("flex flex-col gap-1 rounded-r-md py-1 pl-2", differs && "border-l-2 border-conflict")}>
          <p className="text-label font-medium text-muted-foreground">{label}</p>
          <div className="text-sm break-words whitespace-pre-wrap text-foreground">{app}</div>
        </div>
        <div className={cn("flex flex-col gap-1 rounded-r-md py-1 pl-2", differs && "border-l-2 border-conflict")}>
          <p className="text-label font-medium text-muted-foreground">{label}</p>
          <div className="text-sm break-words whitespace-pre-wrap text-foreground">{shopify}</div>
        </div>
      </div>
    </div>
  );
}

// Shared by every plain-text field (title, price, tags, collection, SEO
// fields, description) — computes the word diff once and renders both
// sides, falling back to an em dash for a genuinely empty field rather than
// diffing against nothing.
//
// Per explicit user report: a price of "122" (Shopify's raw string) vs
// "122.00" (this app's Decimal.toString(), always 2 decimal places per
// @db.Decimal(10, 2) in the schema) is the same price — flagging it as a
// difference was a false positive, not a real conflict. `numeric` opts a
// field into comparing/rendering by parsed value instead of raw string
// equality; every other field keeps plain string comparison.
export function valuesDiffer(a: string, b: string, numeric: boolean): boolean {
  if (!numeric) return a !== b;
  if (a.length === 0 || b.length === 0) return a !== b;
  const numA = Number(a);
  const numB = Number(b);
  if (Number.isNaN(numA) || Number.isNaN(numB)) return a !== b;
  return numA !== numB;
}

function TextDiffRow({
  label,
  appText,
  shopifyText,
  mono = false,
  numeric = false,
  picker,
}: {
  label: string;
  appText: string;
  shopifyText: string;
  mono?: boolean;
  numeric?: boolean;
  picker?: ReactNode;
}) {
  const differs = valuesDiffer(appText, shopifyText, numeric);
  // Numerically-equal-but-differently-formatted values ("122" vs "122.00")
  // are shown normalized to the same text on both sides, rather than the
  // two raw strings that made them look different in the first place.
  const displayApp = numeric && !differs && appText.length > 0 ? Number(appText).toFixed(2) : appText;
  const displayShopify =
    numeric && !differs && shopifyText.length > 0 ? Number(shopifyText).toFixed(2) : shopifyText;
  const textClass = mono ? "font-mono text-table-data" : undefined;
  return (
    <DiffRow
      label={label}
      differs={differs}
      picker={differs ? picker : undefined}
      app={
        <span className={textClass}>
          {displayApp.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : differs ? (
            renderWordDiff(shopifyText, appText, "app")
          ) : (
            displayApp
          )}
        </span>
      }
      shopify={
        <span className={textClass}>
          {displayShopify.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : differs ? (
            renderWordDiff(shopifyText, appText, "shopify")
          ) : (
            displayShopify
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

// Variants are compared by shopifyVariantId — a variant either exists on
// both sides (unchanged/changed), only in the app (added), or only on Shopify (removed).
// A local-only draft variant has no shopifyVariantId, so it shows as "added".
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
    // valuesDiffer(..., true) for price, same false-positive fix as the
    // top-level Price row — "122" vs "122.00" is not a real change.
    const changed =
      match.optionName !== app.optionName ||
      valuesDiffer(match.price, app.price, true) ||
      match.inventory !== app.inventory;
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

// Shows conflictAppSnapshot and conflictShopifySnapshot side by side with
// per-field resolution controls. Every differing field gets a picker (default
// "keep mine"). Shared between the product list (components/product-table.tsx)
// and the product editor (components/product-form.tsx).
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
  const [isResolving, setIsResolving] = useState(false);
  // Only ever holds entries for fields the owner has actually touched —
  // everything else falls back to its default ("keep mine" for a field that
  // differs, either side for one that doesn't) at resolve time. Keeps the
  // "reset on a new product" effect below trivial.
  const [selections, setSelections] = useState<Partial<Record<FieldKey, Side>>>({});

  const appSnapshot = product?.conflictAppSnapshot ?? null;
  const shopifySnapshot = product?.conflictShopifySnapshot ?? null;

  // Fresh product (or dialog re-opened for a different one) — any leftover
  // picks from a previously-resolved conflict shouldn't carry over.
  useEffect(() => {
    setSelections({});
    setError(null);
  }, [product?.id]);

  const fieldDiffers = useMemo((): Record<FieldKey, boolean> | null => {
    if (!appSnapshot || !shopifySnapshot) return null;
    return {
      title: valuesDiffer(appSnapshot.title, shopifySnapshot.title, false),
      description: valuesDiffer(
        htmlToPlainText(appSnapshot.description ?? ""),
        htmlToPlainText(shopifySnapshot.description ?? ""),
        false
      ),
      price: valuesDiffer(appSnapshot.price, shopifySnapshot.price, true),
      status: appSnapshot.status !== shopifySnapshot.status,
      tags: valuesDiffer(appSnapshot.tags.join(", "), shopifySnapshot.tags.join(", "), false),
      collection: appSnapshot.collectionId !== shopifySnapshot.collectionId,
      category: appSnapshot.categoryId !== shopifySnapshot.categoryId,
      seoTitle: valuesDiffer(appSnapshot.seoTitle ?? "", shopifySnapshot.seoTitle ?? "", false),
      seoDescription: valuesDiffer(appSnapshot.seoDescription ?? "", shopifySnapshot.seoDescription ?? "", false),
      variants: diffVariants(appSnapshot.variants, shopifySnapshot.variants).some((entry) => entry.kind !== "unchanged"),
    };
  }, [appSnapshot, shopifySnapshot]);

  // The value actually sent to the server for every field: whatever the
  // owner explicitly picked; otherwise "app" for a field that genuinely
  // differs (the default "keep mine"), or "shopify" for one that doesn't —
  // the two sides are identical there, so it's an arbitrary-but-harmless
  // fill that also keeps the needsPush preview below from treating an
  // untouched, non-differing field as if it were a real edit.
  function resolvedSelection(key: FieldKey): Side {
    return selections[key] ?? (fieldDiffers?.[key] ? "app" : "shopify");
  }

  function buildFullSelections(): ConflictFieldSelections {
    const result = {} as ConflictFieldSelections;
    for (const key of FIELD_KEYS) {
      result[key] = resolvedSelection(key);
    }
    return result;
  }

  const willPush = FIELD_KEYS.some((key) => resolvedSelection(key) === "app");

  const { isPolling: isPushPolling, start: startPushPolling } = useJobPolling({
    onSettled: (status, results) => {
      setIsResolving(false);
      if (status === "SUCCEEDED") {
        onResolved("Resolved and pushed to Shopify");
      } else {
        const message = (results as { error?: string } | undefined)?.error ?? "Push failed";
        setError(message);
      }
    },
    onError: (message) => {
      setIsResolving(false);
      setError(message);
    },
  });

  const isBusy = isResolving || isPushPolling;

  function setField(key: FieldKey, value: Side) {
    setSelections((current) => ({ ...current, [key]: value }));
  }

  function useAllMine() {
    setSelections({});
  }

  function useAllShopify() {
    if (!fieldDiffers) return;
    const next: Partial<Record<FieldKey, Side>> = {};
    for (const key of FIELD_KEYS) {
      if (fieldDiffers[key]) next[key] = "shopify";
    }
    setSelections(next);
  }

  function handleResolve() {
    if (!product) return;
    setError(null);
    setIsResolving(true);
    (async () => {
      const result = await resolveConflictWithSelections(product.id, buildFullSelections());
      if ("error" in result) {
        setIsResolving(false);
        setError(result.error);
        return;
      }
      if (result.jobId) {
        startPushPolling(result.jobId);
        return;
      }
      setIsResolving(false);
      onResolved("Resolved — Shopify's version already matched, nothing to push");
    })();
  }

  function picker(key: FieldKey) {
    return <FieldPicker value={resolvedSelection(key)} onChange={(value) => setField(key, value)} />;
  }

  return (
    <Dialog
      open={product !== null}
      onOpenChange={(open) => {
        if (!open && !isBusy) {
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
            This product changed in Dockit and on Shopify at the same time. Pick which version to keep
            for each field that differs, then resolve.{" "}
            <span className="text-success">Green</span> is only in your version,{" "}
            <span className="text-destructive line-through">red</span> is only on Shopify, and a{" "}
            <span className="border-l-2 border-conflict pl-1 text-conflict">purple bar</span> marks a
            field that differs.
          </DialogDescription>
        </DialogHeader>

        {appSnapshot && shopifySnapshot && (
          <>
            <div className="flex justify-end gap-3 text-label">
              <button type="button" className="font-medium text-primary hover:underline" onClick={useAllMine}>
                Use all mine
              </button>
              <button type="button" className="font-medium text-primary hover:underline" onClick={useAllShopify}>
                Use all Shopify&apos;s
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 pb-2">
                <p className="text-sm font-semibold text-foreground">Your version (Dockit)</p>
                <p className="text-sm font-semibold text-foreground">Shopify version</p>
              </div>
              <TextDiffRow
                label="Title"
                appText={appSnapshot.title}
                shopifyText={shopifySnapshot.title}
                picker={picker("title")}
              />
              <TextDiffRow
                label="Description"
                appText={htmlToPlainText(appSnapshot.description ?? "")}
                shopifyText={htmlToPlainText(shopifySnapshot.description ?? "")}
                picker={picker("description")}
              />
              <TextDiffRow
                label="Price"
                appText={appSnapshot.price}
                shopifyText={shopifySnapshot.price}
                mono
                numeric
                picker={picker("price")}
              />
              <DiffRow
                label="Status"
                differs={fieldDiffers?.status ?? false}
                picker={fieldDiffers?.status ? picker("status") : undefined}
                app={<StatusPreview status={appSnapshot.status} />}
                shopify={<StatusPreview status={shopifySnapshot.status} />}
              />
              <TextDiffRow
                label="Tags"
                appText={appSnapshot.tags.join(", ")}
                shopifyText={shopifySnapshot.tags.join(", ")}
                picker={picker("tags")}
              />
              <TextDiffRow
                label="Collection"
                appText={appSnapshot.collectionTitle ?? ""}
                shopifyText={shopifySnapshot.collectionTitle ?? ""}
                picker={picker("collection")}
              />
              <TextDiffRow
                label="Category"
                appText={appSnapshot.categoryFullName ?? ""}
                shopifyText={shopifySnapshot.categoryFullName ?? ""}
                picker={picker("category")}
              />
              <TextDiffRow
                label="SEO title"
                appText={appSnapshot.seoTitle ?? ""}
                shopifyText={shopifySnapshot.seoTitle ?? ""}
                picker={picker("seoTitle")}
              />
              <TextDiffRow
                label="SEO description"
                appText={appSnapshot.seoDescription ?? ""}
                shopifyText={shopifySnapshot.seoDescription ?? ""}
                picker={picker("seoDescription")}
              />
              <div className="border-t border-border py-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-label font-medium text-muted-foreground">Variants</p>
                  {fieldDiffers?.variants && picker("variants")}
                </div>
                <VariantsDiff appVariants={appSnapshot.variants} shopifyVariants={shopifySnapshot.variants} />
              </div>
            </div>
          </>
        )}

        {error && <p className="px-1 text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" disabled={isBusy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={handleResolve}>
            {isBusy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {willPush ? "Resolving & pushing..." : "Resolving..."}
              </>
            ) : willPush ? (
              "Resolve & push to Shopify"
            ) : (
              "Resolve conflict"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
