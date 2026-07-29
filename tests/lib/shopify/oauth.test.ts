import { createHmac, randomBytes } from "crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  buildAuthorizeUrl,
  decryptAccessToken,
  encryptAccessToken,
  generateOAuthState,
  verifyCallbackHmac,
  verifyOAuthState,
  verifyShopDomain,
} from "@/lib/shopify/oauth";

const TEST_SECRET = "test-client-secret";
const TEST_KEY = randomBytes(32).toString("base64");

beforeEach(() => {
  vi.stubEnv("SHOPIFY_API_KEY", "test-client-id");
  vi.stubEnv("SHOPIFY_API_SECRET", TEST_SECRET);
  vi.stubEnv("SHOPIFY_APP_URL", "https://app.example.com");
  vi.stubEnv("SHOPIFY_SCOPES", "read_products,write_products,read_collections");
  vi.stubEnv("SHOPIFY_TOKEN_ENCRYPTION_KEY", TEST_KEY);
});

describe("verifyShopDomain", () => {
  test("accepts a valid myshopify.com domain", () => {
    expect(verifyShopDomain("my-store.myshopify.com")).toBe(true);
  });

  test("rejects a non-myshopify domain", () => {
    expect(verifyShopDomain("my-store.com")).toBe(false);
    expect(verifyShopDomain("evil.com/../myshopify.com")).toBe(false);
  });
});

describe("buildAuthorizeUrl", () => {
  test("builds the authorize URL with the expected query params", () => {
    const url = new URL(buildAuthorizeUrl("my-store.myshopify.com", "nonce123"));

    expect(url.origin + url.pathname).toBe("https://my-store.myshopify.com/admin/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("scope")).toBe("read_products,write_products,read_collections");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/shopify/oauth/callback"
    );
    expect(url.searchParams.get("state")).toBe("nonce123");
  });
});

function signParams(params: URLSearchParams): string {
  const message = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHmac("sha256", TEST_SECRET).update(message).digest("hex");
}

describe("verifyCallbackHmac", () => {
  test("accepts an hmac computed the same way Shopify computes it", () => {
    const params = new URLSearchParams({
      code: "abc123",
      shop: "my-store.myshopify.com",
      state: "nonce123",
      timestamp: "1690000000",
    });
    params.set("hmac", signParams(params));

    expect(verifyCallbackHmac(params)).toBe(true);
  });

  test("rejects a tampered query string", () => {
    const params = new URLSearchParams({
      code: "abc123",
      shop: "my-store.myshopify.com",
      state: "nonce123",
      timestamp: "1690000000",
    });
    params.set("hmac", signParams(params));
    params.set("shop", "attacker-store.myshopify.com");

    expect(verifyCallbackHmac(params)).toBe(false);
  });
});

describe("encryptAccessToken / decryptAccessToken", () => {
  test("round-trips a token", () => {
    const encrypted = encryptAccessToken("shpat_super_secret_token");
    expect(encrypted).not.toContain("shpat_super_secret_token");
    expect(decryptAccessToken(encrypted)).toBe("shpat_super_secret_token");
  });
});

describe("generateOAuthState / verifyOAuthState", () => {
  test("round-trips and validates the account id", () => {
    const { cookieValue, nonce } = generateOAuthState("account_123");

    expect(verifyOAuthState(cookieValue, nonce)).toEqual({ valid: true, accountId: "account_123" });
  });

  test("rejects a mismatched nonce", () => {
    const { cookieValue } = generateOAuthState("account_123");

    expect(verifyOAuthState(cookieValue, "wrong-nonce")).toEqual({ valid: false });
  });

  test("rejects a tampered cookie value", () => {
    const { cookieValue, nonce } = generateOAuthState("account_123");
    const tampered = cookieValue.replace("account_123", "account_456");

    expect(verifyOAuthState(tampered, nonce)).toEqual({ valid: false });
  });
});
