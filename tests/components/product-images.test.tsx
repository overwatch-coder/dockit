import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductImages } from "@/components/product-images";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("ProductImages", () => {
  const defaultImages = [
    "https://cdn.shopify.com/img1.jpg",
    "https://cdn.shopify.com/img2.jpg",
    "https://cdn.shopify.com/img3.jpg",
  ];

  it("renders gallery thumbnails and marks the first as Hero", () => {
    render(
      <ProductImages
        productId="prod-1"
        images={defaultImages}
        pendingImages={[]}
        onFilesAdded={vi.fn()}
        onRemovePending={vi.fn()}
        isUploadingPending={false}
      />
    );

    expect(screen.getByText("Hero")).toBeInTheDocument();
  });

  it("calls onReorderImages when shifting position with arrow controls", () => {
    const handleReorder = vi.fn();
    render(
      <ProductImages
        productId="prod-1"
        images={defaultImages}
        pendingImages={[]}
        onFilesAdded={vi.fn()}
        onRemovePending={vi.fn()}
        isUploadingPending={false}
        onReorderImages={handleReorder}
      />
    );

    const moveRightButtons = screen.getAllByRole("button", { name: /move right/i });
    expect(moveRightButtons.length).toBeGreaterThan(0);

    // Shift index 0 to the right
    fireEvent.click(moveRightButtons[0]);
    expect(handleReorder).toHaveBeenCalledWith([
      "https://cdn.shopify.com/img2.jpg",
      "https://cdn.shopify.com/img1.jpg",
      "https://cdn.shopify.com/img3.jpg",
    ]);
  });
});
