"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ActionConfirmationModal } from "@/components/action-confirmation-modal";
import { ShopifySyncModal } from "@/components/shopify-sync-modal";
import { Button } from "@/components/ui/button";
import { useJobPolling } from "@/lib/hooks/use-job-polling";
import type { SyncStoreResults } from "@/types/job";

export function SyncStoreButton() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<{ title: string; description: string } | null>(null);

  const { isPolling, start } = useJobPolling({
    onSettled: (status, results) => {
      if (status === "SUCCEEDED") {
        const { syncedCount, conflictedCount } = (results as SyncStoreResults | undefined) ?? {
          syncedCount: 0,
          conflictedCount: 0,
          errorCount: 0,
        };
        setConfirmation({
          title: "Products synced",
          description:
            conflictedCount > 0
              ? `${syncedCount} product${syncedCount === 1 ? "" : "s"} updated, ${conflictedCount} flagged as conflict${conflictedCount === 1 ? "" : "s"}`
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

  function handleSyncStarted(jobId: string) {
    toast.message("Syncing products from Shopify...");
    start(jobId);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isPolling}
        onClick={() => setIsModalOpen(true)}
        className="text-xs sm:text-sm h-8 sm:h-9"
      >
        <RefreshCw className={isPolling ? "size-3.5 sm:size-4 animate-spin" : "size-3.5 sm:size-4"} />
        {isPolling ? (
          "Syncing..."
        ) : (
          <>
            <span className="hidden sm:inline">Sync store</span>
            <span className="sm:hidden">Sync</span>
          </>
        )}
      </Button>

      <ShopifySyncModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSyncStarted={handleSyncStarted}
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

