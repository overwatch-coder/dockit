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
import type { ProductSummary } from "@/lib/db/products";
import type { PushBatchResultItem, PushBatchResults } from "@/types/job";

// "Push all drafts" action — pushes all unsynced products (shopifyProductId === null)
// to Shopify in batch without needing manual selection.
//
// Eligibility, corrected per explicit user feedback: never synced to
// Shopify (shopifyProductId === null) — a product's local DRAFT/ACTIVE
// status doesn't matter here. A locally-DRAFT product that's already been
// pushed once is not re-pushed by this button (that would silently
// overwrite whatever's currently live on Shopify); republishing an
// already-synced product stays the single-product editor's Republish
// button.
export function PushAllDraftsButton({ products }: { products: ProductSummary[] }) {
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
        size="sm"
        disabled={isBusy || unsyncedCount === 0}
        title={unsyncedCount === 0 ? "Every product has already been pushed to Shopify" : undefined}
        onClick={handleClick}
        className="text-xs sm:text-sm h-8 sm:h-9"
      >
        <Send className="size-3.5 sm:size-4" />
        {isBusy ? (
          "Pushing..."
        ) : (
          <>
            <span className="hidden sm:inline">Push new products</span>
            <span className="sm:hidden">Push</span>
            {unsyncedCount > 0 ? ` (${unsyncedCount})` : ""}
          </>
        )}
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
