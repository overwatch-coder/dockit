import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div>User</div>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("AppSidebar", () => {
  test("renders the Products nav item and the mock store switcher", () => {
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    );

    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("My Shopify Store")).toBeInTheDocument();
  });
});
