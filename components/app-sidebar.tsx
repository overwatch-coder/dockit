import { UserButton } from "@clerk/nextjs";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { StoreSwitcher } from "@/components/store-switcher";
import { NavMain } from "@/components/nav-main";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <StoreSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 p-2">
          <UserButton />
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
