import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  BulkGenerationProgressDialog,
  type BulkGenerationProgressItem,
} from "@/components/bulk-generation-progress-dialog";

describe("BulkGenerationProgressDialog", () => {
  const mockItems: BulkGenerationProgressItem[] = [
    {
      id: "prod-1",
      title: "The Complete Snowboard",
      imageUrl: "https://example.com/snowboard1.jpg",
      status: "completed",
      stepDescription: "Content and images generated",
    },
    {
      id: "prod-2",
      title: "The 3p Fulfilled Snowboard",
      imageUrl: null,
      status: "processing",
      stepDescription: "Analyzing reference photos with AI Vision...",
    },
    {
      id: "prod-3",
      title: "The Collection Snowboard: Oxygen",
      imageUrl: null,
      status: "pending",
      stepDescription: "In queue",
    },
  ];

  it("renders progress dialog with items and live progress", () => {
    render(
      <BulkGenerationProgressDialog
        open={true}
        onOpenChange={vi.fn()}
        items={mockItems}
        mode="content-and-images"
        currentIndex={1}
        isComplete={false}
        onClose={vi.fn()}
      />
    );

    // Title & subtitle
    expect(screen.getByText("Generating Images & Content")).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 completed/i)).toBeInTheDocument();

    // Products in the list
    expect(screen.getByText("The Complete Snowboard")).toBeInTheDocument();
    expect(screen.getAllByText("The 3p Fulfilled Snowboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("The Collection Snowboard: Oxygen")).toBeInTheDocument();

    // Active item status
    expect(screen.getByText("Analyzing reference photos with AI Vision...")).toBeInTheDocument();
  });

  it("renders Done button and completion message when finished", () => {
    const handleClose = vi.fn();
    const completedItems = mockItems.map((item) => ({
      ...item,
      status: "completed" as const,
      stepDescription: "Complete",
    }));

    render(
      <BulkGenerationProgressDialog
        open={true}
        onOpenChange={vi.fn()}
        items={completedItems}
        mode="content-only"
        currentIndex={3}
        isComplete={true}
        onClose={handleClose}
      />
    );

    expect(screen.getByText(/3 of 3 completed/i)).toBeInTheDocument();
    const doneButton = screen.getByRole("button", { name: /done/i });
    expect(doneButton).toBeInTheDocument();

    fireEvent.click(doneButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
