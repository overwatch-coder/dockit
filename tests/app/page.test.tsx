import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

vi.mock("@clerk/nextjs", () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <div>User</div>,
  Show: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("Home page", () => {
  test("renders the hero heading and Dockit brand", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Manage your Shopify products/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Dockit")).toBeInTheDocument();
  });

  test("renders the value proposition and how-it-works sections", () => {
    render(<Home />);
    expect(screen.getByText("Draft first, publish on your terms")).toBeInTheDocument();
    expect(screen.getByText("How it works")).toBeInTheDocument();
  });
});
