"use client";

import { usePathname } from "next/navigation";
import { LayoutDashboard, Package } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// Overview (dashboard/analytics) and Products (the real product list, Unit
// 8) are separate destinations, per explicit user request during Unit 8.
const navItems = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Products", href: "/products", icon: Package },
];

export function NavMain() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Application</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href} className="mb-2">
              <SidebarMenuButton
                isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                render={<a href={item.href} />}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
