import { describe, expect, it } from "vitest";
import { shouldSkipSync } from "@/lib/db/products";

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
