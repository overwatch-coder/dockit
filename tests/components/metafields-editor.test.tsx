import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MetafieldsEditor } from "@/components/metafields-editor";
import * as actions from "@/app/(dashboard)/products/actions";

vi.mock("@/app/(dashboard)/products/actions", () => ({
  fetchCategoryAttributesAction: vi.fn(),
  fetchProductMetafieldDefinitionsAction: vi.fn(),
}));

describe("MetafieldsEditor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(actions.fetchCategoryAttributesAction).mockResolvedValue({
      success: true,
      data: [],
    });
    vi.mocked(actions.fetchProductMetafieldDefinitionsAction).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  it("renders empty state when no category is selected", () => {
    render(
      <MetafieldsEditor
        storeId="store_1"
        categoryId={null}
        value={[]}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Select a category above to view and set category metafields/i)
    ).toBeInTheDocument();
  });

  it("fetches and displays category attributes and product definitions", async () => {
    vi.mocked(actions.fetchCategoryAttributesAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: "gid://attr/1",
          name: "Color",
          handle: "color",
          type: "choice",
          choices: ["Cyan", "Purple", "Black"],
        },
        {
          id: "gid://attr/2",
          name: "Snowboard construction",
          handle: "snowboard-construction",
          type: "choice",
          choices: ["Sandwich", "Cap"],
        },
      ],
    });

    vi.mocked(actions.fetchProductMetafieldDefinitionsAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: "gid://def/1",
          name: "Snowboard length",
          namespace: "test_data",
          key: "snowboard_length",
          description: "Length in cm",
          typeName: "dimension",
          category: "MEASUREMENT",
        },
      ],
    });

    const handleChange = vi.fn();

    render(
      <MetafieldsEditor
        storeId="store_1"
        categoryId="cat_snowboards"
        categoryFullName="Sporting Goods > Snowboards"
        value={[
          {
            namespace: "shopify",
            key: "color",
            name: "Color",
            value: "Cyan",
            isCategoryMetafield: true,
          },
        ]}
        onChange={handleChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Sporting Goods > Snowboards")).toBeInTheDocument();
      expect(screen.getByText("Color")).toBeInTheDocument();
      expect(screen.getByText("Snowboard construction")).toBeInTheDocument();
      expect(screen.getByText("Snowboard length")).toBeInTheDocument();
    });
  });

  it("allows setting value for product metafield definition input", async () => {
    vi.mocked(actions.fetchCategoryAttributesAction).mockResolvedValue({
      success: true,
      data: [],
    });

    vi.mocked(actions.fetchProductMetafieldDefinitionsAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: "gid://def/1",
          name: "Snowboard length",
          namespace: "test_data",
          key: "snowboard_length",
          description: "Length in cm",
          typeName: "single_line_text_field",
          category: null,
        },
      ],
    });

    const handleChange = vi.fn();

    render(
      <MetafieldsEditor
        storeId="store_1"
        categoryId="cat_1"
        value={[]}
        onChange={handleChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Snowboard length")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Length in cm/i);
    fireEvent.change(input, { target: { value: "158cm" } });

    expect(handleChange).toHaveBeenCalledWith([
      {
        namespace: "test_data",
        key: "snowboard_length",
        name: "Snowboard length",
        value: "158cm",
        type: "single_line_text_field",
        isCategoryMetafield: false,
      },
    ]);
  });
});
