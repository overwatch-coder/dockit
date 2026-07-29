import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div>User</div>,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: Object.assign(vi.fn(), {
    protect: vi.fn().mockResolvedValue({ userId: "user_test" }),
  }),
}));

vi.mock("@/lib/db/accounts", () => ({
  getOrCreateAccountForClerkUser: vi.fn().mockResolvedValue({
    id: "account_test",
    name: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
}));

vi.mock("@/lib/db/stores", () => ({
  getStoresForAccount: vi.fn().mockResolvedValue([
    { id: "store_test", shopifyDomain: "my-shopify-store.myshopify.com", connectedAt: new Date() },
  ]),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("AppSidebar", () => {
  test("renders the Products nav item and the connected store", async () => {
    render(
      <SidebarProvider>
        {await AppSidebar()}
      </SidebarProvider>
    );

    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("my-shopify-store.myshopify.com")).toBeInTheDocument();
  });
});
