import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductPaginationNav } from "@/components/product-pagination-nav";

describe("ProductPaginationNav", () => {
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
});
