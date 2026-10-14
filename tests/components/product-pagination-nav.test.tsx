import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductPaginationNav } from "@/components/product-pagination-nav";

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe("ProductPaginationNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it("renders counter and active navigation links when prev and next exist", () => {
    render(
      <ProductPaginationNav
        currentIndex={3}
        totalCount={10}
        prevProductId="prod-2"
        nextProductId="prod-4"
      />
    );

    expect(screen.getByText("3 of 10")).toBeInTheDocument();

    const prevLink = screen.getByRole("link", { name: /previous product/i });
    expect(prevLink).toHaveAttribute("href", "/products/prod-2");

    const nextLink = screen.getByRole("link", { name: /next product/i });
    expect(nextLink).toHaveAttribute("href", "/products/prod-4");
  });

  it("disables previous button on the first item", () => {
    render(
      <ProductPaginationNav
        currentIndex={1}
        totalCount={5}
        prevProductId={null}
        nextProductId="prod-2"
      />
    );

    expect(screen.getByText("1 of 5")).toBeInTheDocument();

    const prevButton = screen.getByRole("button", { name: /previous product/i });
    expect(prevButton).toBeDisabled();

    const nextLink = screen.getByRole("link", { name: /next product/i });
    expect(nextLink).toHaveAttribute("href", "/products/prod-2");
  });

  it("disables next button on the last item", () => {
    render(
      <ProductPaginationNav
        currentIndex={5}
        totalCount={5}
        prevProductId="prod-4"
        nextProductId={null}
      />
    );

    expect(screen.getByText("5 of 5")).toBeInTheDocument();

    const prevLink = screen.getByRole("link", { name: /previous product/i });
    expect(prevLink).toHaveAttribute("href", "/products/prod-4");

    const nextButton = screen.getByRole("button", { name: /next product/i });
    expect(nextButton).toBeDisabled();
  });

  it("navigates on J and K keyboard shortcuts", () => {
    render(
      <ProductPaginationNav
        currentIndex={2}
        totalCount={5}
        prevProductId="prod-1"
        nextProductId="prod-3"
      />
    );

    fireEvent.keyDown(window, { key: "j" });
    expect(mockPush).toHaveBeenCalledWith("/products/prod-3");

    fireEvent.keyDown(window, { key: "k" });
    expect(mockPush).toHaveBeenCalledWith("/products/prod-1");
  });

  it("does not navigate via J/K if typing in an input element", () => {
    render(
      <div>
        <input data-testid="test-input" />
        <ProductPaginationNav
          currentIndex={2}
          totalCount={5}
          prevProductId="prod-1"
          nextProductId="prod-3"
        />
      </div>
    );

    const input = screen.getByTestId("test-input");
    fireEvent.keyDown(input, { key: "j" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("preserves URL search params in navigation links", () => {
    mockSearchParams = new URLSearchParams({ status: "DRAFT", search: "shoes" });
    render(
      <ProductPaginationNav
        currentIndex={2}
        totalCount={5}
        prevProductId="prod-1"
        nextProductId="prod-3"
      />
    );

    const nextLink = screen.getByRole("link", { name: /next product/i });
    expect(nextLink).toHaveAttribute("href", "/products/prod-3?status=DRAFT&search=shoes");
  });
});
