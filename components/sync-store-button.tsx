"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { syncStore } from "@/app/(dashboard)/products/actions";
import { ActionConfirmationModal } from "@/components/action-confirmation-modal";
import { Button } from "@/components/ui/button";
import { useJobPolling } from "@/lib/hooks/use-job-polling";
import type { SyncStoreResults } from "@/types/job";

// Unit 17: pulls the store's current Shopify catalog into the database.
// Structured identically to components/push-all-drafts-button.tsx — a
// useTransition for the enqueue call, useJobPolling for settling, the
// shared ActionConfirmationModal on success. No PushResultsDialog here: a
// newly-synced product isn't in any client-side productTitles map the way
// a push/delete's caller-selected ids are, so per-item results aren't
// presentable the same way — a single aggregate count is the right level
// of detail for this action.
export function SyncStoreButton() {
  const router = useRouter();
  const [isEnqueuing, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<{ title: string; description: string } | null>(null);

  const { isPolling, start } = useJobPolling({
    onSettled: (status, results) => {
      if (status === "SUCCEEDED") {
        const { syncedCount, skippedCount } = (results as SyncStoreResults | undefined) ?? {
          syncedCount: 0,
          skippedCount: 0,
          errorCount: 0,
        };
        setConfirmation({
          title: "Store synced",
          description:
            skippedCount > 0
              ? `${syncedCount} product${syncedCount === 1 ? "" : "s"} updated, ${skippedCount} skipped (unpushed local changes)`
              : `${syncedCount} product${syncedCount === 1 ? "" : "s"} updated`,
        });
      } else {
        const message = (results as { error?: string } | undefined)?.error ?? "Sync failed";
        toast.error(message);
      }
      router.refresh();
    },
    onError: (message) => toast.error(message),
  });

  function handleClick() {
    startTransition(async () => {
      const result = await syncStore();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.message("Syncing store...");
      start(result.jobId);
    });
  }

  const isBusy = isEnqueuing || isPolling;

  return (
    <>
      <Button variant="outline" size="sm" disabled={isBusy} onClick={handleClick}>
        <RefreshCw className="size-4" />
        {isBusy ? "Syncing..." : "Sync store"}
      </Button>
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
