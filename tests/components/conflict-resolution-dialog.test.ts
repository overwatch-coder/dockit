import { describe, expect, it } from "vitest";
import { valuesDiffer } from "@/components/conflict-resolution-dialog";

describe("valuesDiffer", () => {
  it("compares non-numeric fields by plain string equality", () => {
    expect(valuesDiffer("Blue Shirt", "Blue Shirt", false)).toBe(false);
    expect(valuesDiffer("Blue Shirt", "Red Shirt", false)).toBe(true);
  });

  it("treats differently-formatted equal numbers as not differing when numeric", () => {
    expect(valuesDiffer("122", "122.00", true)).toBe(false);
    expect(valuesDiffer("122.0", "122", true)).toBe(false);
    expect(valuesDiffer("19.99", "19.990", true)).toBe(false);
  });

  it("still flags genuinely different numbers as differing when numeric", () => {
    expect(valuesDiffer("122", "123", true)).toBe(true);
    expect(valuesDiffer("19.99", "20.00", true)).toBe(true);
  });

  it("falls back to string comparison if either side isn't a parseable number", () => {
    expect(valuesDiffer("N/A", "122", true)).toBe(true);
    expect(valuesDiffer("N/A", "N/A", true)).toBe(false);
  });

  it("treats an empty string as differing from any non-empty value, numeric or not", () => {
    expect(valuesDiffer("", "122", true)).toBe(true);
    expect(valuesDiffer("", "", true)).toBe(false);
  });
});
