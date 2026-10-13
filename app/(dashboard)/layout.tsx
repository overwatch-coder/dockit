import { auth } from "@clerk/nextjs/server";
import { AppSidebar } from "@/components/app-sidebar";
import { JobStatusIndicator } from "@/components/job-status-indicator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await auth.protect();

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        {/* Fixed above the scroll area (not `sticky` inside it) so it never
            moves — the sidebar collapse toggle stays reachable regardless of
            scroll position. */}
        <header className="flex h-12 sm:h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-4">
          <SidebarTrigger />
          <div className="ml-auto">
            <JobStatusIndicator />
          </div>
        </header>
        {/* `scroll-smooth` was tried here to help with a reported scroll-lag
            issue but made it worse — CSS smooth-scroll animates every
            programmatic scroll (Next.js navigation, focus-driven
            scrollIntoView from dropdowns/dialogs), which reads as exactly
            "the scrollbar jumps ahead, content catches up late" once the
            main thread has any real work competing for paint time. Plain
            `overflow-y-auto` (instant scroll) plus `overscroll-contain`
            (harmless — no animation, just stops scroll chaining to the
            page behind this one) is the fix. */}
        <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain">{children}</div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
