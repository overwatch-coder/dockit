"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/rich-text-editor";
import { sanitizeDescriptionHtml } from "@/lib/sanitize-description";

interface AiDescriptionReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDescriptionHtml: string;
  suggestedDescriptionHtml: string;
  onAccept: (acceptedHtml: string) => void;
}

export function AiDescriptionReviewDialog({
  open,
  onOpenChange,
  currentDescriptionHtml,
  suggestedDescriptionHtml,
  onAccept,
}: AiDescriptionReviewDialogProps) {
  const [editedHtml, setEditedHtml] = useState(suggestedDescriptionHtml);
  const [editorVersion, setEditorVersion] = useState(0);

  // Adjusting state during render (not in an effect) is the React-endorsed
  // way to reset the edited draft each time the dialog opens with a fresh
  // suggestion, without an extra setState-in-effect — same pattern as
  // components/connect-store-dialog.tsx:
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setEditedHtml(suggestedDescriptionHtml);
      setEditorVersion((v) => v + 1);
    }
  }

  const sanitizedCurrent = currentDescriptionHtml
    ? sanitizeDescriptionHtml(currentDescriptionHtml)
    : "";

  function handleApply() {
    onAccept(editedHtml);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-11/12 max-w-5xl sm:max-w-5xl md:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review AI Description</DialogTitle>
          <DialogDescription>
            Compare your current description with the AI suggestion side by side. You can edit the AI suggestion in the rich text editor before accepting.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
          {/* Current Version */}
          <div className="flex flex-col gap-2 border border-border rounded-lg p-4 bg-surface">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current Version
            </span>
            <div className="min-h-32 text-sm text-foreground">
              {sanitizedCurrent ? (
                <div
                  className="[&_a]:text-primary [&_a]:underline [&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: sanitizedCurrent }}
                />
              ) : (
                <span className="italic text-muted-foreground">(No description)</span>
              )}
            </div>
          </div>

          {/* AI Suggested Version (Rich Text Editor) */}
          <div className="flex flex-col gap-2 border border-primary/40 rounded-lg p-4 bg-primary-subtle/30">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              AI Suggestion (Editable)
            </span>
            <div className="min-h-32 bg-background rounded-lg">
              <RichTextEditor
                defaultValue={suggestedDescriptionHtml}
                onChange={setEditedHtml}
                externalContent={{ html: suggestedDescriptionHtml, version: editorVersion }}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Discard
          </Button>
          <Button type="button" onClick={handleApply}>
            Accept & Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
