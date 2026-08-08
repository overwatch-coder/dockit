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

vi.mock("@/lib/db/stores", () => {
  const testStore = {
    id: "store_test",
    shopifyDomain: "my-shopify-store.myshopify.com",
    name: "My Shopify Store",
    connectedAt: new Date(),
  };
  return {
    getStoresForAccount: vi.fn().mockResolvedValue([testStore]),
    getActiveStoreForAccount: vi.fn().mockReturnValue(testStore),
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}));

vi.mock("@/lib/active-store-cookie", () => ({
  ACTIVE_STORE_COOKIE_NAME: "active-store-id",
}));

vi.mock("@/app/(dashboard)/stores/actions", () => ({
  setActiveStore: vi.fn(),
  connectStore: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("AppSidebar", () => {
  test("renders the Products nav item and the connected store's display name", async () => {
    render(
      <SidebarProvider>
        {await AppSidebar()}
      </SidebarProvider>
    );

    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("My Shopify Store")).toBeInTheDocument();
  });
});
