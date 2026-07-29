import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  test("renders the default starter heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1 })
    ).toBeInTheDocument();
  });
});
