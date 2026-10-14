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
});
