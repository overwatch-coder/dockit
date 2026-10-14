import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GoogleSerpPreview } from "@/components/google-serp-preview";

describe("GoogleSerpPreview", () => {
  it("renders Google search snippet with title, URL, and meta description", () => {
    render(
      <GoogleSerpPreview
        title="The Complete Snowboard | Dockit"
        description="Dominate every mountain run with responsive wood core and sintered base."
        handle="complete-snowboard"
        shopDomain="snow-shop.myshopify.com"
        siteName="Snow Shop"
      />
    );

    // Title link
    expect(screen.getByText("The Complete Snowboard | Dockit")).toBeInTheDocument();

    // Domain & Site name
    expect(screen.getByText("Snow Shop")).toBeInTheDocument();
    expect(screen.getByText(/snow-shop\.myshopify\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/complete-snowboard/i)).toBeInTheDocument();

    // Description snippet
    expect(
      screen.getByText("Dominate every mountain run with responsive wood core and sintered base.")
    ).toBeInTheDocument();
  });

  it("handles empty fields gracefully with sensible fallbacks", () => {
    render(
      <GoogleSerpPreview
        title=""
        description=""
      />
    );

    expect(screen.getByText(/Product Title/i)).toBeInTheDocument();
    expect(screen.getByText(/products/i)).toBeInTheDocument();
  });

  it("strips HTML tags from description if raw HTML is passed", () => {
    render(
      <GoogleSerpPreview
        title="Eco Coffee Mug"
        description="<p>Double walled <strong>ceramic</strong> travel mug.</p>"
      />
    );

    expect(
      screen.getByText(/Double walled ceramic travel mug\./i)
    ).toBeInTheDocument();
  });

  it("switches to Social Share card view when tab is clicked", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(
      <GoogleSerpPreview
        title="Trail Running Shoes"
        description="Lightweight waterproof trail shoes for rough terrains."
        shopDomain="trail-store.myshopify.com"
        imageUrl="https://cdn.shopify.com/shoe.jpg"
      />
    );

    const socialTab = screen.getByRole("button", { name: /social share/i });
    fireEvent.click(socialTab);

    expect(screen.getByText("trail-store.myshopify.com")).toBeInTheDocument();
    expect(screen.getByText("Trail Running Shoes")).toBeInTheDocument();
  });

  it("calculates live focus keyword placements across title, meta, and body", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(
      <GoogleSerpPreview
        title="Waterproof Hiking Boots"
        description="Durable waterproof boots built for all seasons."
        bodyHtml="<p>These waterproof boots feature Vibram soles.</p>"
      />
    );

    const keywordInput = screen.getByPlaceholderText(/target focus keyword/i);
    fireEvent.change(keywordInput, { target: { value: "waterproof" } });

    expect(screen.getByText("SEO Perfect")).toBeInTheDocument();
    expect(screen.getByText("In Title")).toBeInTheDocument();
    expect(screen.getByText("In Meta")).toBeInTheDocument();
    expect(screen.getByText("In Body")).toBeInTheDocument();
  });
});
