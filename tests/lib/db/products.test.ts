import { describe, expect, it } from "vitest";
import { duplicateProductTitle, shouldSkipSync } from "@/lib/db/products";

describe("duplicateProductTitle", () => {
  it("adds the Copy suffix to the source title", () => {
    expect(duplicateProductTitle("Adu Denim Shirt")).toBe("Adu Denim Shirt Copy");
  });

  it("trims surrounding whitespace before adding the suffix", () => {
    expect(duplicateProductTitle("  Adu Denim Shirt  ")).toBe("Adu Denim Shirt Copy");
  });
});

describe("shouldSkipSync", () => {
  it("returns false when the product has never been synced", () => {
    expect(shouldSkipSync({ lastEditedAt: new Date("2026-01-01"), lastSyncedAt: null })).toBe(false);
  });

  it("returns false when the last edit happened before the last sync", () => {
    expect(
      shouldSkipSync({
        lastEditedAt: new Date("2026-01-01T00:00:00Z"),
        lastSyncedAt: new Date("2026-01-02T00:00:00Z"),
      })
    ).toBe(false);
  });

  it("returns true when the last edit happened after the last sync", () => {
    expect(
      shouldSkipSync({
        lastEditedAt: new Date("2026-01-03T00:00:00Z"),
        lastSyncedAt: new Date("2026-01-02T00:00:00Z"),
      })
    ).toBe(true);
  });

  it("returns false when lastEditedAt exactly equals lastSyncedAt", () => {
    const timestamp = new Date("2026-01-02T00:00:00Z");
    expect(shouldSkipSync({ lastEditedAt: timestamp, lastSyncedAt: timestamp })).toBe(false);
  });
});
