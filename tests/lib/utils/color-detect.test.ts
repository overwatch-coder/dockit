import { describe, expect, it } from "vitest";
import {
  detectColorFromName,
  isValidHexColor,
  PRESET_SWATCHES,
} from "@/lib/utils/color-detect";

describe("detectColorFromName", () => {
  it("detects basic single-word colors", () => {
    expect(detectColorFromName("Black")).toBe("#000000");
    expect(detectColorFromName("White")).toBe("#FFFFFF");
    expect(detectColorFromName("Red")).toBe("#EF4444");
    expect(detectColorFromName("Blue")).toBe("#3B82F6");
    expect(detectColorFromName("Green")).toBe("#10B981");
  });

  it("detects compound and apparel color names", () => {
    expect(detectColorFromName("Navy Blue")).toBe("#001F3F");
    expect(detectColorFromName("Heather Grey")).toBe("#9CA3AF");
    expect(detectColorFromName("Army Green")).toBe("#4B5320");
    expect(detectColorFromName("Off White")).toBe("#FAF9F6");
    expect(detectColorFromName("Dusty Rose")).toBe("#DCAE96");
    expect(detectColorFromName("Rose Gold")).toBe("#B76E79");
  });

  it("detects colors embedded in variant option strings with sizes or slashes", () => {
    expect(detectColorFromName("Small / Burgundy")).toBe("#800020");
    expect(detectColorFromName("XL - Olive")).toBe("#556B2F");
    expect(detectColorFromName("Charcoal / 32")).toBe("#374151");
    expect(detectColorFromName("Cotton Tee (Beige, Medium)")).toBe("#F5F5DC");
  });

  it("detects embedded hex codes", () => {
    expect(detectColorFromName("Custom #3498DB")).toBe("#3498DB");
    expect(detectColorFromName("#ff5733")).toBe("#FF5733");
  });

  it("returns null for non-color options", () => {
    expect(detectColorFromName("Small")).toBeNull();
    expect(detectColorFromName("Medium")).toBeNull();
    expect(detectColorFromName("Large")).toBeNull();
    expect(detectColorFromName("32GB")).toBeNull();
    expect(detectColorFromName("Pack of 3")).toBeNull();
    expect(detectColorFromName("")).toBeNull();
  });
});

describe("isValidHexColor", () => {
  it("validates 3 and 6 digit hex colors", () => {
    expect(isValidHexColor("#fff")).toBe(true);
    expect(isValidHexColor("#FFFFFF")).toBe(true);
    expect(isValidHexColor("#1e3a8a")).toBe(true);
    expect(isValidHexColor("red")).toBe(false);
    expect(isValidHexColor("#12345")).toBe(false);
    expect(isValidHexColor("")).toBe(false);
  });
});

describe("PRESET_SWATCHES", () => {
  it("provides valid hex colors for the picker UI", () => {
    expect(PRESET_SWATCHES.length).toBeGreaterThan(10);
    for (const swatch of PRESET_SWATCHES) {
      expect(isValidHexColor(swatch.hex)).toBe(true);
      expect(swatch.name).toBeTruthy();
    }
  });
});
