"use client";

import { useState, useTransition, type ReactNode } from "react";
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

function StatusPreview({ status }: { status: ProductStatus }) {
  if (status === "ACTIVE") {
    return <Badge className="border-transparent bg-success/10 text-success">Active</Badge>;
  }
  return <Badge className="border-transparent bg-warning/10 text-warning">Draft</Badge>;
}

// Unit 19: one labeled row of the diff — highlights both cells with
// `--conflict` (the token ui-context.md reserves specifically for conflict
// indicators) whenever the two sides actually differ, so the owner can scan
// straight to what changed instead of re-reading every field.
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
      <div className="flex flex-col gap-1">
        <p className="text-label font-medium text-muted-foreground">{label}</p>
        <div className={cn("text-sm text-foreground", differs && "rounded-md bg-conflict/10 p-1.5")}>{app}</div>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-label font-medium text-muted-foreground">{label}</p>
        <div className={cn("text-sm text-foreground", differs && "rounded-md bg-conflict/10 p-1.5")}>{shopify}</div>
      </div>
    </div>
  );
}

function variantsKey(variants: ConflictSnapshot["variants"]): string {
  return variants.map((v) => `${v.optionName}|${v.price}|${v.inventory}`).join(";");
}

function VariantsList({ variants }: { variants: ConflictSnapshot["variants"] }) {
  if (variants.length === 0) {
    return <p className="text-muted-foreground">No variants</p>;
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {variants.map((variant, index) => (
        <li key={index} className="font-mono text-table-data">
          {variant.optionName} — {variant.price} — {variant.inventory} in stock
        </li>
      ))}
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resolve conflict: {product?.title}</DialogTitle>
          <DialogDescription>
            This product changed in Dockit and on Shopify at the same time. Choose which version to
            keep — highlighted fields are the ones that differ.
          </DialogDescription>
        </DialogHeader>

        {appSnapshot && shopifySnapshot && (
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 pb-2">
              <p className="text-sm font-semibold text-foreground">Your version (Dockit)</p>
              <p className="text-sm font-semibold text-foreground">Shopify version</p>
            </div>
            <DiffRow
              label="Title"
              app={appSnapshot.title}
              shopify={shopifySnapshot.title}
              differs={appSnapshot.title !== shopifySnapshot.title}
            />
            <DiffRow
              label="Description"
              differs={appSnapshot.description !== shopifySnapshot.description}
              app={
                <div
                  className="max-h-32 overflow-y-auto"
                  // Same sanitize-then-render convention as the live preview
                  // panel in components/product-form.tsx — both snapshots
                  // are already-persisted description HTML, re-sanitized
                  // here since this is a fresh render context.
                  dangerouslySetInnerHTML={{ __html: sanitizeDescriptionHtml(appSnapshot.description ?? "") }}
                />
              }
              shopify={
                <div
                  className="max-h-32 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: sanitizeDescriptionHtml(shopifySnapshot.description ?? "") }}
                />
              }
            />
            <DiffRow
              label="Price"
              app={<span className="font-mono text-table-data">{appSnapshot.price}</span>}
              shopify={<span className="font-mono text-table-data">{shopifySnapshot.price}</span>}
              differs={appSnapshot.price !== shopifySnapshot.price}
            />
            <DiffRow
              label="Status"
              app={<StatusPreview status={appSnapshot.status} />}
              shopify={<StatusPreview status={shopifySnapshot.status} />}
              differs={appSnapshot.status !== shopifySnapshot.status}
            />
            <DiffRow
              label="Tags"
              app={appSnapshot.tags.length > 0 ? appSnapshot.tags.join(", ") : "—"}
              shopify={shopifySnapshot.tags.length > 0 ? shopifySnapshot.tags.join(", ") : "—"}
              differs={appSnapshot.tags.join(",") !== shopifySnapshot.tags.join(",")}
            />
            <DiffRow
              label="Collection"
              app={appSnapshot.collectionTitle ?? "—"}
              shopify={shopifySnapshot.collectionTitle ?? "—"}
              differs={appSnapshot.collectionId !== shopifySnapshot.collectionId}
            />
            <DiffRow
              label="SEO title"
              app={appSnapshot.seoTitle ?? "—"}
              shopify={shopifySnapshot.seoTitle ?? "—"}
              differs={appSnapshot.seoTitle !== shopifySnapshot.seoTitle}
            />
            <DiffRow
              label="SEO description"
              app={appSnapshot.seoDescription ?? "—"}
              shopify={shopifySnapshot.seoDescription ?? "—"}
              differs={appSnapshot.seoDescription !== shopifySnapshot.seoDescription}
            />
            <DiffRow
              label="Variants"
              app={<VariantsList variants={appSnapshot.variants} />}
              shopify={<VariantsList variants={shopifySnapshot.variants} />}
              differs={variantsKey(appSnapshot.variants) !== variantsKey(shopifySnapshot.variants)}
            />
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
