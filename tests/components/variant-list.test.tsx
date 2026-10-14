import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("renders color swatch button and allows auto-detecting swatches from variant names", () => {
    const onChange = vi.fn();
    const variants: DraftVariant[] = [
      {
        id: "var-1",
        optionName: "Navy Blue / Large",
        price: "29.99",
        inventory: "10",
        imageUrl: null,
        colorHex: null,
      },
      {
        id: "var-2",
        optionName: "Burgundy / Medium",
        price: "29.99",
        inventory: "15",
        imageUrl: null,
        colorHex: null,
      },
    ];

    render(
      <VariantList
        variants={variants}
        images={[]}
        onChange={onChange}
      />
    );

    // Verify swatch buttons exist
    const swatchButtons = screen.getAllByRole("button", { name: /set variant color swatch/i });
    expect(swatchButtons).toHaveLength(2);

    // Click Auto-Detect Swatches
    const autoDetectBtn = screen.getByRole("button", { name: /auto-detect swatches/i });
    expect(autoDetectBtn).toBeInTheDocument();
    fireEvent.click(autoDetectBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedVariants: DraftVariant[] = onChange.mock.calls[0][0];
    expect(updatedVariants[0].colorHex).toBe("#001F3F"); // Navy Blue
    expect(updatedVariants[1].colorHex).toBe("#800020"); // Burgundy
  });

  it("displays existing color swatch indicator", () => {
    const variants: DraftVariant[] = [
      {
        id: "var-1",
        optionName: "Red / Small",
        price: "20.00",
        inventory: "5",
        imageUrl: null,
        colorHex: "#EF4444",
      },
    ];

    render(
      <VariantList
        variants={variants}
        images={[]}
        onChange={vi.fn()}
      />
    );

    const swatchBtn = screen.getByRole("button", { name: /variant color #EF4444/i });
    expect(swatchBtn).toBeInTheDocument();
  });
});
