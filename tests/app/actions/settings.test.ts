import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStoreAction,
} from "@/app/(dashboard)/stores/actions";
import {
  saveAppCredentialsAction,
  saveLegacyTokenAction,
  disconnectStoreAction,
  deleteStoreAction,
  unlinkStoreAction,
} from "@/app/(dashboard)/settings/actions";
import { ACTIVE_STORE_COOKIE_NAME } from "@/lib/active-store-cookie";
import * as storeDb from "@/lib/db/stores";
import * as shopApi from "@/lib/shopify/shop";
import * as importJobs from "@/lib/jobs/import";

const mockSetCookie = vi.fn();
const mockDeleteCookie = vi.fn();
const mockGetCookie = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(async () => ({
    set: mockSetCookie,
    delete: mockDeleteCookie,
    get: mockGetCookie,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: {
    protect: vi.fn().mockResolvedValue({ userId: "clerk_user_123" }),
  },
}));

vi.mock("@/lib/db/accounts", () => ({
  getOrCreateAccountForClerkUser: vi.fn().mockResolvedValue({ id: "acc_123" }),
}));

describe("createStoreAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails if store name is empty or whitespace", async () => {
    const result = await createStoreAction("   ");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Enter a name for your store");
    }
    expect(mockSetCookie).not.toHaveBeenCalled();
  });

  it("creates store and sets active store cookie on success", async () => {
    vi.spyOn(storeDb, "createStore").mockResolvedValue({
      id: "store_new_1",
      name: "My New Store",
      shopifyDomain: null,
      connectedAt: null,
    });

    const result = await createStoreAction("My New Store");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.storeId).toBe("store_new_1");
    }
    expect(mockSetCookie).toHaveBeenCalledWith(
      ACTIVE_STORE_COOKIE_NAME,
      "store_new_1",
      expect.objectContaining({ path: "/" })
    );
  });
});

describe("saveAppCredentialsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails with invalid shop domain", async () => {
    const result = await saveAppCredentialsAction({
      storeId: "store_1",
      shopDomain: "invalid domain",
      apiKey: "client_id_123",
      apiSecret: "client_secret_456",
    });
    expect(result.success).toBe(false);
  });

  it("fails with missing apiKey or apiSecret", async () => {
    const result = await saveAppCredentialsAction({
      storeId: "store_1",
      shopDomain: "mystore.myshopify.com",
      apiKey: "",
      apiSecret: "secret",
    });
    expect(result.success).toBe(false);
  });

  it("saves credentials and returns normalized domain on success", async () => {
    vi.spyOn(storeDb, "isShopDomainConnected").mockResolvedValue(false);
    const saveSpy = vi.spyOn(storeDb, "saveStoreAppCredentials").mockResolvedValue();

    const result = await saveAppCredentialsAction({
      storeId: "store_1",
      shopDomain: "mystore",
      apiKey: "client_id_123",
      apiSecret: "client_secret_456",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.shopDomain).toBe("mystore.myshopify.com");
    }
    expect(saveSpy).toHaveBeenCalledWith({
      accountId: "acc_123",
      storeId: "store_1",
      shopDomain: "mystore.myshopify.com",
      apiKey: "client_id_123",
      apiSecret: "client_secret_456",
    });
  });
});

describe("saveLegacyTokenAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails if token fails Shopify verification", async () => {
    vi.spyOn(storeDb, "isShopDomainConnected").mockResolvedValue(false);
    vi.spyOn(shopApi, "fetchShopName").mockResolvedValue({
      success: false,
      error: "401 Unauthorized",
    });

    const result = await saveLegacyTokenAction({
      storeId: "store_1",
      shopDomain: "mystore.myshopify.com",
      accessToken: "shpat_invalid_token_123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Could not connect to Shopify");
    }
  });

  it("saves token, triggers import, and returns preview on successful verification", async () => {
    vi.spyOn(storeDb, "isShopDomainConnected").mockResolvedValue(false);
    vi.spyOn(shopApi, "fetchShopName").mockResolvedValue({
      success: true,
      data: { name: "Cool Store" },
    });
    const saveTokenSpy = vi.spyOn(storeDb, "saveStoreAccessToken").mockResolvedValue();
    const importSpy = vi.spyOn(importJobs, "triggerStoreImport").mockResolvedValue();

    const result = await saveLegacyTokenAction({
      storeId: "store_1",
      shopDomain: "mystore.myshopify.com",
      accessToken: "shpat_1234567890abcdef",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.shopDomain).toBe("mystore.myshopify.com");
      expect(result.tokenPreview).toContain("shpat_");
    }
    expect(saveTokenSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acc_123",
        storeId: "store_1",
        shopDomain: "mystore.myshopify.com",
        name: "Cool Store",
      })
    );
    expect(importSpy).toHaveBeenCalledWith({
      accountId: "acc_123",
      storeId: "store_1",
      shopifyDomain: "mystore.myshopify.com",
    });
  });
});

describe("disconnectStoreAction & deleteStoreAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disconnectStoreAction calls disconnectStoreShopify", async () => {
    const disconnectSpy = vi.spyOn(storeDb, "disconnectStoreShopify").mockResolvedValue();

    const result = await disconnectStoreAction({ storeId: "store_1" });
    expect(result.success).toBe(true);
    expect(disconnectSpy).toHaveBeenCalledWith({
      accountId: "acc_123",
      storeId: "store_1",
    });
  });

  it("deleteStoreAction calls deleteStore and deletes active cookie if active", async () => {
    vi.spyOn(storeDb, "deleteStore").mockResolvedValue({ deleted: true });
    mockGetCookie.mockReturnValue({ value: "store_1" });

    const result = await deleteStoreAction({ storeId: "store_1" });
    expect(result.success).toBe(true);
    expect(mockDeleteCookie).toHaveBeenCalledWith(ACTIVE_STORE_COOKIE_NAME);
  });

  it("unlinkStoreAction calls unlinkStoreShopify and keeps store data", async () => {
    const unlinkSpy = vi.spyOn(storeDb, "unlinkStoreShopify").mockResolvedValue();

    const result = await unlinkStoreAction({ storeId: "store_1" });
    expect(result.success).toBe(true);
    expect(unlinkSpy).toHaveBeenCalledWith({
      accountId: "acc_123",
      storeId: "store_1",
    });
  });
});

describe("saveStoreAiRulesAction & resetStoreAiRulesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails if storeId is missing", async () => {
    const { saveStoreAiRulesAction } = await import("@/app/(dashboard)/settings/actions");
    const result = await saveStoreAiRulesAction({
      storeId: "   ",
      rules: {
        brandTone: "Tone",
        titleRule: "Title",
        descriptionRule: "Desc",
        tagsRule: "Tags",
        seoRule: "SEO",
        customInstructions: "",
      },
    });
    expect(result.success).toBe(false);
  });

  it("saves valid AI generation rules scoped to store", async () => {
    const aiDb = await import("@/lib/db/ai-rules");
    const saveSpy = vi.spyOn(aiDb, "saveAiRulesForStore").mockResolvedValue({
      brandTone: "Custom Tone",
      titleRule: "Custom Title",
      descriptionRule: "Custom Desc",
      tagsRule: "Custom Tags",
      seoRule: "Custom SEO",
      customInstructions: "No clickbait",
    });

    const { saveStoreAiRulesAction } = await import("@/app/(dashboard)/settings/actions");
    const result = await saveStoreAiRulesAction({
      storeId: "store_1",
      rules: {
        brandTone: "Custom Tone",
        titleRule: "Custom Title",
        descriptionRule: "Custom Desc",
        tagsRule: "Custom Tags",
        seoRule: "Custom SEO",
        customInstructions: "No clickbait",
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.rules.brandTone).toBe("Custom Tone");
      expect(result.rules.customInstructions).toBe("No clickbait");
    }
    expect(saveSpy).toHaveBeenCalledWith("acc_123", "store_1", expect.objectContaining({
      brandTone: "Custom Tone",
      customInstructions: "No clickbait",
    }));
  });

  it("resets AI rules back to default", async () => {
    const aiDb = await import("@/lib/db/ai-rules");
    const resetSpy = vi.spyOn(aiDb, "resetAiRulesForStore").mockResolvedValue({
      brandTone: "Default Tone",
      titleRule: "Default Title",
      descriptionRule: "Default Desc",
      tagsRule: "Default Tags",
      seoRule: "Default SEO",
      customInstructions: "",
    });

    const { resetStoreAiRulesAction } = await import("@/app/(dashboard)/settings/actions");
    const result = await resetStoreAiRulesAction({ storeId: "store_1" });

    expect(result.success).toBe(true);
    expect(resetSpy).toHaveBeenCalledWith("acc_123", "store_1");
  });
});
