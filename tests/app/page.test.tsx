import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Home from "@/app/page";

vi.mock("@clerk/nextjs", () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <div>User</div>,
  Show: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("Home page", () => {
  test("renders the hero heading, Dockit brand, and technical invariants without badges", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: /One Task at a Time/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Dockit")[0]).toBeInTheDocument();

    // Verify technical invariants in hero
    expect(screen.getByText(/GraphQL Admin API/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero live store overwrites/i)).toBeInTheDocument();
    expect(screen.getByText(/Rate-limit cost tracking/i)).toBeInTheDocument();

    // Verify no AI-slop top badge one-liners exist
    expect(screen.queryByText("Draft & Sync Engine")).not.toBeInTheDocument();
    expect(screen.queryByText(/Start Managing Smarter Today/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Interactive Workspace Showcase/i)).not.toBeInTheDocument();
  });

  test("renders the value proposition and how-it-works sections", () => {
    render(<Home />);
    expect(screen.getByText(/Integration ecosystem/i)).toBeInTheDocument();
    expect(screen.getByText("How Dockit Works")).toBeInTheDocument();
    expect(screen.getByText("Authorize Shopify Store")).toBeInTheDocument();
    expect(screen.getByText("Draft & Generate with AI")).toBeInTheDocument();
    expect(screen.getByText("Push or Sync with Conflict Guard")).toBeInTheDocument();
  });

  test("showcase allows switching between catalog, conflict, ai, and sync tabs", () => {
    render(<Home />);

    // Default tab: Catalog Matrix
    expect(screen.getByText("Catalog Queue")).toBeInTheDocument();
    expect(screen.getByText("Minimalist Leather Backpack")).toBeInTheDocument();

    // Switch to Conflict Resolver tab
    fireEvent.click(screen.getByRole("button", { name: /Conflict Resolver/i }));
    expect(screen.getByText(/Conflict Detected:/i)).toBeInTheDocument();
    expect(screen.getByText("DOCKIT DRAFT (LOCAL)")).toBeInTheDocument();
    expect(screen.getByText("SHOPIFY LIVE (REMOTE)")).toBeInTheDocument();

    // Switch to AI Taxonomy tab
    fireEvent.click(screen.getByRole("button", { name: /AI Taxonomy/i }));
    expect(screen.getByText("AI Taxonomy & Metadata Generator")).toBeInTheDocument();
    expect(screen.getByText(/Apparel & Accessories > Handbags/i)).toBeInTheDocument();

    // Switch to Sync Engine tab
    fireEvent.click(screen.getByRole("button", { name: /Sync Engine/i }));
    expect(screen.getByText("Shopify Store Synchronization")).toBeInTheDocument();
    expect(screen.getByText("40 / 40 pts")).toBeInTheDocument();
  });

  test("showcase allows filtering products by status", () => {
    render(<Home />);

    // Filter to Drafts
    fireEvent.click(screen.getByRole("button", { name: /Drafts \(2\)/i }));
    expect(screen.getByText("Organic Cotton Oversized Hoodie")).toBeInTheDocument();
    expect(screen.getByText("Wireless Noise-Canceling Headphones")).toBeInTheDocument();
    expect(screen.queryByText("Ceramic Minimalist Mug Set")).not.toBeInTheDocument();

    // Filter to Conflicts
    fireEvent.click(screen.getByRole("button", { name: /Conflicts/i }));
    expect(screen.getByText("Ergonomic Mechanical Keyboard")).toBeInTheDocument();
    expect(screen.queryByText("Organic Cotton Oversized Hoodie")).not.toBeInTheDocument();
  });
});
