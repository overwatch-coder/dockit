import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VariantList, type DraftVariant } from "@/components/variant-list";

describe("VariantList", () => {
  it("attaches and displays the main product image for the main variant when imageUrl is null", () => {
    const variants: DraftVariant[] = [
      {
        id: "var-1",
        optionName: "Default Title",
        price: "1025.00",
        inventory: "50",
        imageUrl: null,
      },
    ];

    const images = ["https://cdn.shopify.com/main-product.jpg"];

    render(
      <VariantList
        variants={variants}
        images={images}
        onChange={vi.fn()}
      />
    );

    // Should find an image tag rendering the fallback main product image
    const img = screen.getByRole("button", { name: /change variant image/i });
    expect(img).toBeInTheDocument();
  });

  it("renders empty icon when variant has no image and product has no images", () => {
    const variants: DraftVariant[] = [
      {
        id: "var-1",
        optionName: "Default Title",
        price: "1025.00",
        inventory: "50",
        imageUrl: null,
      },
    ];

    render(
      <VariantList
        variants={variants}
        images={[]}
        onChange={vi.fn()}
      />
    );

    const button = screen.getByRole("button", { name: /set variant image/i });
    expect(button).toBeInTheDocument();
  });
});
