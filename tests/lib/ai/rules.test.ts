import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DEFAULT_AI_RULES,
  resolveEffectiveAiRules,
  storeAiRulesFormSchema,
  encodeImageRules,
  extractImageRules,
} from "@/lib/ai/rules";
import {
  getAiRulesForStore,
  hasCustomAiRules,
  saveAiRulesForStore,
  resetAiRulesForStore,
} from "@/lib/db/ai-rules";
import { prisma } from "@/lib/db/client";

vi.mock("@/lib/db/client", () => ({
  prisma: {
    store: {
      findFirst: vi.fn(),
    },
    storeAiRule: {
      findFirst: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

describe("lib/ai/rules: defaults and resolver", () => {
  it("DEFAULT_AI_RULES has all required non-empty fields", () => {
    expect(DEFAULT_AI_RULES.brandTone.length).toBeGreaterThan(10);
    expect(DEFAULT_AI_RULES.titleRule.length).toBeGreaterThan(10);
    expect(DEFAULT_AI_RULES.descriptionRule.length).toBeGreaterThan(10);
    expect(DEFAULT_AI_RULES.tagsRule.length).toBeGreaterThan(10);
    expect(DEFAULT_AI_RULES.seoRule.length).toBeGreaterThan(10);
  });

  it("resolveEffectiveAiRules falls back to default when input is undefined or empty", () => {
    const resolved = resolveEffectiveAiRules(null);
    expect(resolved.brandTone).toBe(DEFAULT_AI_RULES.brandTone);
    expect(resolved.titleRule).toBe(DEFAULT_AI_RULES.titleRule);
    expect(resolved.customInstructions).toBe("");

    const partialEmpty = resolveEffectiveAiRules({
      brandTone: "   ",
      customInstructions: "Always write in French",
    });
    expect(partialEmpty.brandTone).toBe(DEFAULT_AI_RULES.brandTone);
    expect(partialEmpty.customInstructions).toBe("Always write in French");
  });

  it("storeAiRulesFormSchema validates normal inputs and blocks oversized fields", () => {
    const valid = storeAiRulesFormSchema.safeParse({
      brandTone: "Tone",
      titleRule: "Title",
      descriptionRule: "Desc",
      tagsRule: "Tags",
      seoRule: "SEO",
      customInstructions: "Instructions",
      presentationStyle: "on_model",
      modelFaceDirective: "Maintain model facial features",
    });
    expect(valid.success).toBe(true);

    const oversized = storeAiRulesFormSchema.safeParse({
      brandTone: "a".repeat(1500),
      titleRule: "Title",
      descriptionRule: "Desc",
      tagsRule: "Tags",
      seoRule: "SEO",
      customInstructions: "Instructions",
    });
    expect(oversized.success).toBe(false);
  });

  it("extractImageRules and encodeImageRules correctly serialize and parse image rules", () => {
    const raw = "Never mention plastic.";
    const encoded = encodeImageRules(raw, {
      presentationStyle: "on_model",
      modelFaceDirective: "Use realistic lighting and maintain model face",
    });

    expect(encoded).toContain("Never mention plastic.");
    expect(encoded).toContain("<!-- dockit:image_rules");

    const decoded = extractImageRules(encoded);
    expect(decoded.cleanCustomInstructions).toBe("Never mention plastic.");
    expect(decoded.presentationStyle).toBe("on_model");
    expect(decoded.modelFaceDirective).toBe("Use realistic lighting and maintain model face");
  });

  it("resolveEffectiveAiRules extracts presentation style and keeps customInstructions clean for text prompts", () => {
    const saved = {
      customInstructions:
        "Only British English.\n\n<!-- dockit:image_rules {\"presentationStyle\":\"ghost_mannequin\",\"modelFaceDirective\":\"Hollow body drape\"} -->",
    };

    const resolved = resolveEffectiveAiRules(saved);
    expect(resolved.customInstructions).toBe("Only British English.");
    expect(resolved.presentationStyle).toBe("ghost_mannequin");
    expect(resolved.modelFaceDirective).toBe("Hollow body drape");
  });
});


describe("lib/db/ai-rules: database queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAiRulesForStore returns defaults when no row exists", async () => {
    vi.mocked(prisma.storeAiRule.findFirst).mockResolvedValue(null);

    const rules = await getAiRulesForStore("acc_1", "store_1");
    expect(rules).toEqual(DEFAULT_AI_RULES);
    expect(prisma.storeAiRule.findFirst).toHaveBeenCalledWith({
      where: { storeId: "store_1", accountId: "acc_1" },
    });
  });

  it("getAiRulesForStore returns custom rules when row exists", async () => {
    vi.mocked(prisma.storeAiRule.findFirst).mockResolvedValue({
      id: "rule_1",
      accountId: "acc_1",
      storeId: "store_1",
      brandTone: "Nordic Minimalist",
      titleRule: "Title Rule",
      descriptionRule: "Description Rule",
      tagsRule: "Tags Rule",
      seoRule: "SEO Rule",
      customInstructions: "Never mention plastic",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const rules = await getAiRulesForStore("acc_1", "store_1");
    expect(rules.brandTone).toBe("Nordic Minimalist");
    expect(rules.customInstructions).toBe("Never mention plastic");
  });

  it("hasCustomAiRules returns true if row count > 0", async () => {
    vi.mocked(prisma.storeAiRule.count).mockResolvedValue(1);
    const hasRules = await hasCustomAiRules("acc_1", "store_1");
    expect(hasRules).toBe(true);

    vi.mocked(prisma.storeAiRule.count).mockResolvedValue(0);
    const noRules = await hasCustomAiRules("acc_1", "store_1");
    expect(noRules).toBe(false);
  });

  it("saveAiRulesForStore throws if store does not belong to account", async () => {
    vi.mocked(prisma.store.findFirst).mockResolvedValue(null);

    await expect(
      saveAiRulesForStore("acc_1", "store_1", DEFAULT_AI_RULES)
    ).rejects.toThrow("Store not found or access denied.");
  });

  it("saveAiRulesForStore upserts storeAiRule when store belongs to account", async () => {
    vi.mocked(prisma.store.findFirst).mockResolvedValue({ id: "store_1" } as any);
    vi.mocked(prisma.storeAiRule.upsert).mockResolvedValue({
      id: "rule_1",
      accountId: "acc_1",
      storeId: "store_1",
      brandTone: "Custom Tone",
      titleRule: "Custom Title",
      descriptionRule: "Custom Desc",
      tagsRule: "Custom Tags",
      seoRule: "Custom SEO",
      customInstructions: "Custom Instructions",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const saved = await saveAiRulesForStore("acc_1", "store_1", {
      brandTone: "Custom Tone",
      titleRule: "Custom Title",
      descriptionRule: "Custom Desc",
      tagsRule: "Custom Tags",
      seoRule: "Custom SEO",
      customInstructions: "Custom Instructions",
    });

    expect(saved.brandTone).toBe("Custom Tone");
    expect(prisma.storeAiRule.upsert).toHaveBeenCalledWith({
      where: { storeId: "store_1" },
      create: expect.objectContaining({
        accountId: "acc_1",
        storeId: "store_1",
        brandTone: "Custom Tone",
      }),
      update: expect.objectContaining({
        brandTone: "Custom Tone",
      }),
    });
  });

  it("resetAiRulesForStore deletes custom rule and returns DEFAULT_AI_RULES", async () => {
    vi.mocked(prisma.storeAiRule.deleteMany).mockResolvedValue({ count: 1 });

    const result = await resetAiRulesForStore("acc_1", "store_1");
    expect(result).toEqual(DEFAULT_AI_RULES);
    expect(prisma.storeAiRule.deleteMany).toHaveBeenCalledWith({
      where: { storeId: "store_1", accountId: "acc_1" },
    });
  });
});
