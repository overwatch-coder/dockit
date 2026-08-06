"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { pushAllDrafts } from "@/app/(dashboard)/products/actions";
import { ActionConfirmationModal } from "@/components/action-confirmation-modal";
import { Button } from "@/components/ui/button";
import { PushResultsDialog } from "@/components/push-results-dialog";
import { useJobPolling } from "@/lib/hooks/use-job-polling";
import type { Product } from "@/types/product";
import type { PushBatchResultItem, PushBatchResults } from "@/types/job";

// Unit 16 follow-up, per explicit user request: "Push selected" (in
// components/product-table.tsx's row-selection toolbar) still requires an
// explicit selection every time — this is the no-selection counterpart for
// the common case of "just push everything that isn't on Shopify yet."
// Reuses the same batch job/eligibility machinery via pushAllDrafts, just
// with a server-computed id list instead of a caller-supplied one.
//
// Eligibility, corrected per explicit user feedback: never synced to
// Shopify (shopifyProductId === null) — a product's local DRAFT/ACTIVE
// status doesn't matter here. A locally-DRAFT product that's already been
// pushed once is not re-pushed by this button (that would silently
// overwrite whatever's currently live on Shopify); republishing an
// already-synced product stays the single-product editor's Republish
// button.
export function PushAllDraftsButton({ products }: { products: Product[] }) {
  const router = useRouter();
  const unsyncedCount = useMemo(
    () => products.filter((product) => product.shopifyProductId === null && !product.isConflicted).length,
    [products]
  );
  const productTitles = useMemo(
    () => Object.fromEntries(products.map((product) => [product.id, product.title])),
    [products]
  );

  const [isEnqueuing, startTransition] = useTransition();
  const [resultsItems, setResultsItems] = useState<PushBatchResultItem[] | null>(null);
  // Per explicit user request: a toast alone wasn't a strong enough "did
  // this actually work" signal — a clean SUCCEEDED result opens the shared
  // animated-checkmark confirmation instead. PARTIAL/FAILED keep the
  // existing toast + PushResultsDialog treatment.
  const [confirmation, setConfirmation] = useState<{ title: string; description: string } | null>(null);

  const { isPolling, start } = useJobPolling({
    onSettled: (status, results) => {
      const items = (results as PushBatchResults | undefined)?.items ?? [];
      const succeeded = items.filter((item) => item.success).length;
      const failed = items.length - succeeded;
      if (status === "SUCCEEDED") {
        setConfirmation({
          title: "Pushed to Shopify",
          description: `${succeeded} of ${items.length} product${items.length === 1 ? "" : "s"} synced successfully`,
        });
      } else {
        toast.error(`Pushed ${succeeded} of ${items.length} products — ${failed} failed`);
        setResultsItems(items);
      }
      router.refresh();
    },
    onError: (message) => toast.error(message),
  });

  function handleClick() {
    startTransition(async () => {
      const result = await pushAllDrafts();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.message(`Pushing ${result.count} product${result.count === 1 ? "" : "s"}...`);
      start(result.jobId);
    });
  }

  const isBusy = isEnqueuing || isPolling;

  return (
    <>
      <Button
        variant="outline"
        disabled={isBusy || unsyncedCount === 0}
        title={unsyncedCount === 0 ? "Every product has already been pushed to Shopify" : undefined}
        onClick={handleClick}
      >
        <Send className="size-4" />
        {isBusy ? "Pushing..." : `Push new products${unsyncedCount > 0 ? ` (${unsyncedCount})` : ""}`}
      </Button>
      <PushResultsDialog
        open={resultsItems !== null}
        onOpenChange={(open) => {
          if (!open) setResultsItems(null);
        }}
        items={resultsItems ?? []}
        productTitles={productTitles}
      />
      <ActionConfirmationModal
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        title={confirmation?.title ?? ""}
        description={confirmation?.description}
      />
    </>
  );
}
