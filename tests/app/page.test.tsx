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
      screen.getByRole("heading", { level: 1, name: /One Task at a Time/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Dockit")[0]).toBeInTheDocument();
  });

  test("renders the value proposition and how-it-works sections", () => {
    render(<Home />);
    expect(screen.getByText("Integration ecosystem")).toBeInTheDocument();
    expect(screen.getByText("How Dockit Works")).toBeInTheDocument();
  });
});
