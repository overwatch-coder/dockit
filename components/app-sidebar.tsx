import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { getStoresForAccount } from "@/lib/db/stores";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { StoreSwitcher } from "@/components/store-switcher";
import { NavMain } from "@/components/nav-main";
import { ThemeToggle } from "@/components/theme-toggle";

export async function AppSidebar() {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);
  const stores = await getStoresForAccount(account.id);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <StoreSwitcher stores={stores} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
      </SidebarContent>
      <SidebarFooter>
        {/* Collapsed to icon-width, UserButton + ThemeToggle side by side
            don't fit (48px rail vs. two 32px controls) and overflow — stack
            them vertically instead of squeezing horizontally. */}
        <div className="flex items-center justify-between gap-2 p-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:p-1">
          <UserButton />
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
