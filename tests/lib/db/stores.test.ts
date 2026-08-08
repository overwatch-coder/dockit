import { describe, expect, it } from "vitest";
import { getActiveStoreForAccount } from "@/lib/db/stores";
import type { Store } from "@/types/store";

function makeStore(id: string): Store {
  return { id, shopifyDomain: `${id}.myshopify.com`, name: null, connectedAt: null };
}

describe("getActiveStoreForAccount", () => {
  const storeA = makeStore("store-a");
  const storeB = makeStore("store-b");
  const stores = [storeA, storeB];

  it("returns the store matching the cookie when it belongs to the account", () => {
    expect(getActiveStoreForAccount(stores, "store-b")).toBe(storeB);
  });

  it("falls back to the first store when the cookie doesn't match any of the account's stores", () => {
    // Covers both a stale cookie (deleted store) and a tampered one
    // (another account's store id) — this function can't tell those apart,
    // and shouldn't need to; either way, it's not a valid selection.
    expect(getActiveStoreForAccount(stores, "someone-elses-store")).toBe(storeA);
  });

  it("falls back to the first store when the cookie is unset", () => {
    expect(getActiveStoreForAccount(stores, null)).toBe(storeA);
  });

  it("returns null when the account has no stores at all", () => {
    expect(getActiveStoreForAccount([], "store-a")).toBeNull();
    expect(getActiveStoreForAccount([], null)).toBeNull();
  });
});
