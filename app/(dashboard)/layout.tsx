import { auth } from "@clerk/nextjs/server";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

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
            scroll position. Right side is reserved for Unit 20's job status
            indicator; nothing lives there yet. */}
        <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-2">
          <SidebarTrigger />
        </header>
        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
