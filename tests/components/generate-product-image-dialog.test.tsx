import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GenerateProductImageDialog } from "@/components/generate-product-image-dialog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/use-job-polling", () => ({
  useJobPolling: () => ({
    isPolling: false,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock("@/app/(dashboard)/products/actions", () => ({
  enqueueGenerateProductImagesAction: vi.fn().mockResolvedValue({
    success: true,
    jobId: "job_123",
  }),
}));

vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));

describe("GenerateProductImageDialog", () => {
  const mockProduct = {
    id: "prod-1",
    title: "The Draft Snowboard",
    imageUrl: "https://example.com/snowboard.jpg",
    imageUrls: ["https://example.com/snowboard.jpg", "https://example.com/snowboard-2.jpg"],
  };

  it("renders the dialog with all modes and active selection full description", () => {
    render(
      <GenerateProductImageDialog
        open={true}
        onOpenChange={vi.fn()}
        product={mockProduct}
      />
    );

    // Dialog title & target product
    expect(screen.getByText("AI Image Generation Pipeline")).toBeInTheDocument();
    expect(screen.getByText("The Draft Snowboard")).toBeInTheDocument();

    // Mode labels and taglines
    expect(screen.getByText("Variation")).toBeInTheDocument();
    expect(screen.getByText("Studio variations")).toBeInTheDocument();

    expect(screen.getByText("Refine")).toBeInTheDocument();
    expect(screen.getByText("Clarity & textures")).toBeInTheDocument();

    expect(screen.getByText("New Angle")).toBeInTheDocument();
    expect(screen.getByText("Side, 45°, flat lay")).toBeInTheDocument();

    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.getByText("Prompt-directed")).toBeInTheDocument();

    // Default active selection is Variation Mode - full description is visible
    expect(
      screen.getByText(
        "Generate creative variations in a clean commercial studio setting while keeping your product's core identity intact."
      )
    ).toBeInTheDocument();
  });

  it("updates the active selection full description when switching modes", () => {
    render(
      <GenerateProductImageDialog
        open={true}
        onOpenChange={vi.fn()}
        product={mockProduct}
      />
    );

    // Switch to Refine mode
    const refineButton = screen.getByText("Refine").closest("button");
    expect(refineButton).not.toBeNull();
    fireEvent.click(refineButton!);

    expect(
      screen.getByText(
        "Enhance image clarity, polish lighting, and sharpen intricate textures without altering product geometry."
      )
    ).toBeInTheDocument();

    // Switch to New Angle mode
    const angleButton = screen.getByText("New Angle").closest("button");
    expect(angleButton).not.toBeNull();
    fireEvent.click(angleButton!);

    expect(
      screen.getByText(
        "Render alternative perspectives such as 45° commercial angles, flat-lay overhead layouts, or side profiles."
      )
    ).toBeInTheDocument();
  });

  it("renders all aspect ratio options with dimensions", () => {
    render(
      <GenerateProductImageDialog
        open={true}
        onOpenChange={vi.fn()}
        product={mockProduct}
      />
    );

    expect(screen.getByText("Square (1:1)")).toBeInTheDocument();
    expect(screen.getByText("1024x1024")).toBeInTheDocument();

    expect(screen.getByText("Standard (4:3)")).toBeInTheDocument();
    expect(screen.getByText("1024x768")).toBeInTheDocument();

    expect(screen.getByText("Banner (16:9)")).toBeInTheDocument();
    expect(screen.getByText("1792x1024")).toBeInTheDocument();

    expect(screen.getByText("Vertical (3:4)")).toBeInTheDocument();
    expect(screen.getByText("1024x1365")).toBeInTheDocument();

    expect(screen.getByText("Story (9:16)")).toBeInTheDocument();
    expect(screen.getByText("1024x1792")).toBeInTheDocument();
  });
});
