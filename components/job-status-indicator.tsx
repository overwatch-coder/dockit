"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, TriangleAlert, X, XCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLatestJobStatus } from "@/lib/hooks/use-latest-job-status";
import { cn } from "@/lib/utils";
import type { Job, JobType, PushBatchResultItem } from "@/types/job";

const JOB_TYPE_LABEL: Record<JobType, string> = {
  PUSH: "Push",
  SYNC: "Sync",
  DELETE: "Delete",
  GENERATE_IMAGE: "Image Generation",
};

const JOB_TYPE_RUNNING_LABEL: Record<JobType, string> = {
  PUSH: "Pushing…",
  SYNC: "Syncing…",
  DELETE: "Deleting…",
  GENERATE_IMAGE: "Generating images…",
};

export type JobResultItem = { productId: string; success: boolean; detail?: string };
export type JobResultDescription = { summary: string; items?: JobResultItem[] };

// Maps Job.results shapes across job types to human-readable summaries and item lists.
// Exported and pure so it's testable without mounting the component.
export function describeJobResult(job: Job): JobResultDescription {
  const results = job.results;
  if (!results || typeof results !== "object") {
    return { summary: "Something went wrong." };
  }
  const r = results as Record<string, unknown>;

  // Batch push: { items: PushBatchResultItem[] }
  if (Array.isArray(r.items)) {
    const items = r.items as PushBatchResultItem[];
    const succeeded = items.filter((item) => item.success).length;
    const failed = items.length - succeeded;
    return {
      summary: `${succeeded} of ${items.length} product${items.length === 1 ? "" : "s"} pushed${
        failed > 0 ? ` — ${failed} failed` : ""
      }.`,
      items: items.map((item) => ({
        productId: item.productId,
        success: item.success,
        detail: item.success ? undefined : item.error,
      })),
    };
  }

  // Single push/delete: bare { productId, shopifyProductId } or
  // { productId, failedStep, error } — no wrapper, distinguished by whether
  // `error` is present (single-item jobs never settle PARTIAL, only FAILED).
  if (typeof r.productId === "string") {
    const isFailure = typeof r.error === "string";
    return {
      summary: isFailure ? `${JOB_TYPE_LABEL[job.type]} failed for one product.` : `${JOB_TYPE_LABEL[job.type]} succeeded.`,
      items: [{ productId: r.productId, success: !isFailure, detail: isFailure ? (r.error as string) : undefined }],
    };
  }

  // Sync: { syncedCount, conflictedCount, errorCount }
  if (typeof r.syncedCount === "number") {
    const parts = [`${r.syncedCount} synced`];
    if (typeof r.conflictedCount === "number" && r.conflictedCount > 0) parts.push(`${r.conflictedCount} conflicted`);
    if (typeof r.errorCount === "number" && r.errorCount > 0) parts.push(`${r.errorCount} failed`);
    return { summary: `${parts.join(", ")}.` };
  }

  // Store import on connect: { importedCount }
  if (typeof r.importedCount === "number") {
    return { summary: `${r.importedCount} product${r.importedCount === 1 ? "" : "s"} imported.` };
  }

  // Image Generation: { generatedUrls, count }
  if (Array.isArray(r.generatedUrls)) {
    const count = typeof r.count === "number" ? r.count : r.generatedUrls.length;
    return { summary: `Generated ${count} product image${count === 1 ? "" : "s"}.` };
  }

  // Generic sync/import failure: { error }
  if (typeof r.error === "string") {
    return { summary: r.error };
  }

  return { summary: "Something went wrong." };
}

const TERMINAL_STATUS_STYLE: Record<"SUCCEEDED" | "PARTIAL" | "FAILED", string> = {
  SUCCEEDED: "border-success/30 bg-success/10 text-success",
  PARTIAL: "border-warning/30 bg-warning/10 text-warning",
  FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
};

const TERMINAL_STATUS_LABEL: Record<"SUCCEEDED" | "PARTIAL" | "FAILED", string> = {
  SUCCEEDED: "complete",
  PARTIAL: "partially failed",
  FAILED: "failed",
};

const DISMISSED_JOB_STORAGE_KEY = "dockit.dismissed-job-id";
const DISMISSED_JOB_EVENT = "dockit:dismissed-job-changed";

function subscribeToDismissedJob(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(DISMISSED_JOB_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DISMISSED_JOB_EVENT, callback);
  };
}

function getDismissedJobId(): string | null {
  return window.localStorage.getItem(DISMISSED_JOB_STORAGE_KEY);
}

function getServerDismissedJobId(): null {
  return null;
}

function dismissJob(jobId: string): void {
  window.localStorage.setItem(DISMISSED_JOB_STORAGE_KEY, jobId);
  window.dispatchEvent(new Event(DISMISSED_JOB_EVENT));
}

// Persistent top-bar job status indicator — mounted in app/(dashboard)/layout.tsx's header
// to display ambient job progress across pages. Renders nothing when idle or dismissed.
//
// Follow-up, per explicit user feedback from live use: this originally also
// hid a clean SUCCEEDED job, on the assumption the triggering page's own
// toast already covered that moment — but that toast never fires if the
// owner has navigated away, which is exactly this indicator's reason to
// exist. A sync/push finishing with zero feedback anywhere read as "it just
// disappeared, did it even work?". Every terminal status (SUCCEEDED,
// PARTIAL, FAILED) now renders a pill that persists until the owner
// dismisses it or a new job supersedes it — only the in-flight
// PENDING/RUNNING state is transient/non-interactive.
export function JobStatusIndicator() {
  const { job } = useLatestJobStatus();
  // A layout remounts on dashboard navigation, so component state alone
  // would resurrect a just-dismissed completion pill. Keeping only the job
  // id in local storage preserves that dismissal across pages/reloads; a
  // newly-created manual sync has a different id and therefore appears.
  const dismissedJobId = useSyncExternalStore(
    subscribeToDismissedJob,
    getDismissedJobId,
    getServerDismissedJobId
  );
  const [open, setOpen] = useState(false);

  if (!job || job.id === dismissedJobId) {
    return null;
  }

  if (job.status === "PENDING" || job.status === "RUNNING") {
    const r = job.results as Record<string, unknown> | null;
    const progress = typeof r?.progress === "number" ? r.progress : null;
    const stage = typeof r?.stage === "string" ? r.stage : null;

    return (
      <div
        className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-label text-foreground-muted shadow-xs"
        title={stage || JOB_TYPE_RUNNING_LABEL[job.type]}
      >
        <Loader2 className="size-3.5 animate-spin text-primary" />
        <span className="font-medium">
          {JOB_TYPE_RUNNING_LABEL[job.type]}
          {progress !== null ? ` ${progress}%` : ""}
        </span>
      </div>
    );
  }

  // SUCCEEDED, PARTIAL, or FAILED — persists until the owner dismisses it or
  // a new job starts (dismissedJobId only ever matches this exact job's
  // id), per ui-context.md's own word "persistent" and the reason the link
  // exists at all: the owner might not be on the page that started this job
  // anymore.
  const status = job.status;
  const description = describeJobResult(job);
  const StatusIcon = status === "SUCCEEDED" ? CheckCircle2 : TriangleAlert;

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-label font-medium",
                TERMINAL_STATUS_STYLE[status]
              )}
            />
          }
        >
          <StatusIcon className="size-3.5" />
          {JOB_TYPE_LABEL[job.type]} {TERMINAL_STATUS_LABEL[status]}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <p className="text-sm text-foreground">{description.summary}</p>
          {description.items && description.items.length > 0 && (
            <div className="mt-2 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {description.items.map((item) => (
                <Link
                  key={item.productId}
                  href={`/products/${item.productId}`}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2 rounded-md border border-border px-2 py-1.5 text-sm hover:bg-primary-subtle"
                >
                  {item.success ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <span className="flex flex-col overflow-hidden">
                    <span className="truncate text-foreground">View product</span>
                    {item.detail && <span className="truncate text-destructive">{item.detail}</span>}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismissJob(job.id)}
        className="rounded-full p-1 text-foreground-subtle hover:bg-surface hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
