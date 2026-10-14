import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StoreAiRulesForm } from "@/components/store-ai-rules-form";
import { DEFAULT_AI_RULES } from "@/lib/ai/rules";
import * as actions from "@/app/(dashboard)/settings/actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/app/(dashboard)/settings/actions", () => ({
  saveStoreAiRulesAction: vi.fn().mockImplementation(async (input: any) => ({
    success: true,
    rules: input.rules,
  })),
  resetStoreAiRulesAction: vi.fn().mockResolvedValue({
    success: true,
    rules: {
      brandTone: "default",
      titleRule: "default",
      descriptionRule: "default",
      tagsRule: "default",
      seoRule: "default",
      customInstructions: "",
      presentationStyle: "product_only",
      modelFaceDirective: "",
    },
  }),
}));


describe("StoreAiRulesForm", () => {
  it("renders all form sections including AI image generation presentation mode", () => {
    render(
      <StoreAiRulesForm
        storeId="store_1"
        storeName="Acme Store"
        initialRules={DEFAULT_AI_RULES}
      />
    );

    // Main header
    expect(screen.getByText("AI Generation Rules")).toBeInTheDocument();
    expect(screen.getByText("Acme Store")).toBeInTheDocument();

    // Section 7: AI Image Generation Presentation & Model Face Consistency
    expect(
      screen.getByText("AI Image Generation Presentation & Model Face Consistency")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Product Only (Flat Lay / Studio)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("On-Model (Keep Face & Identity)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("3D Ghost / Invisible Mannequin")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Studio Mannequin")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Default Model Face & Mannequin Consistency Directive")
    ).toBeInTheDocument();
  });

  it("allows selecting presentation mode and entering model face directives, then saves", async () => {
    const saveMock = vi.spyOn(actions, "saveStoreAiRulesAction");

    render(
      <StoreAiRulesForm
        storeId="store_1"
        storeName="Acme Store"
        initialRules={DEFAULT_AI_RULES}
      />
    );

    // Select On-Model
    const onModelBtn = screen.getByText("On-Model (Keep Face & Identity)").closest("button");
    expect(onModelBtn).not.toBeNull();
    fireEvent.click(onModelBtn!);

    // Enter Model Face Directive
    const directiveInput = screen.getByPlaceholderText(
      /Always preserve the exact model face/i
    );
    fireEvent.change(directiveInput, {
      target: { value: "Maintain female model face across all variants" },
    });

    // Save Rules
    const submitBtn = screen.getByRole("button", { name: /Save Rules for Acme Store/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith({
        storeId: "store_1",
        rules: expect.objectContaining({
          presentationStyle: "on_model",
          modelFaceDirective: "Maintain female model face across all variants",
        }),
      });
    });
  });
});
