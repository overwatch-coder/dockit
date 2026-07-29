import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

vi.mock("@clerk/nextjs", () => ({
  SignInButton: () => <button>Sign in</button>,
  SignUpButton: () => <button>Sign up</button>,
  UserButton: () => <div>User</div>,
  Show: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("Home page", () => {
  test("renders the Dockit heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Dockit" })
    ).toBeInTheDocument();
  });
});
