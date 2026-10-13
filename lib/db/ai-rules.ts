import { prisma } from "@/lib/db/client";
import {
  type StoreAiRules,
  DEFAULT_AI_RULES,
  resolveEffectiveAiRules,
} from "@/lib/ai/rules";

/**
 * Retrieves the effective AI rules for a store, scoped strictly to accountId and storeId.
 * Falls back to DEFAULT_AI_RULES if no custom rules have been saved yet.
 */
export async function getAiRulesForStore(
  accountId: string,
  storeId: string
): Promise<StoreAiRules> {
  const delegate = (prisma as unknown as { storeAiRule?: typeof prisma.storeAiRule }).storeAiRule;
  if (!delegate || typeof delegate.findFirst !== "function") {
    return { ...DEFAULT_AI_RULES };
  }

  const record = await delegate.findFirst({
    where: {
      storeId,
      accountId,
    },
  });

  if (!record) {
    return { ...DEFAULT_AI_RULES };
  }

  return resolveEffectiveAiRules({
    brandTone: record.brandTone ?? undefined,
    titleRule: record.titleRule ?? undefined,
    descriptionRule: record.descriptionRule ?? undefined,
    tagsRule: record.tagsRule ?? undefined,
    seoRule: record.seoRule ?? undefined,
    customInstructions: record.customInstructions ?? undefined,
  });
}

/**
 * Checks whether the store has actively saved custom AI rules.
 */
export async function hasCustomAiRules(
  accountId: string,
  storeId: string
): Promise<boolean> {
  const delegate = (prisma as unknown as { storeAiRule?: typeof prisma.storeAiRule }).storeAiRule;
  if (!delegate || typeof delegate.count !== "function") {
    return false;
  }

  const count = await delegate.count({
    where: {
      storeId,
      accountId,
    },
  });
  return count > 0;
}

/**
 * Persists customized AI rules for a specific store.
 */
export async function saveAiRulesForStore(
  accountId: string,
  storeId: string,
  rules: StoreAiRules
): Promise<StoreAiRules> {
  // Ensure the store belongs to this account
  const store = await prisma.store.findFirst({
    where: { id: storeId, accountId },
    select: { id: true },
  });

  if (!store) {
    throw new Error("Store not found or access denied.");
  }

  const record = await prisma.storeAiRule.upsert({
    where: { storeId },
    create: {
      accountId,
      storeId,
      brandTone: rules.brandTone.trim(),
      titleRule: rules.titleRule.trim(),
      descriptionRule: rules.descriptionRule.trim(),
      tagsRule: rules.tagsRule.trim(),
      seoRule: rules.seoRule.trim(),
      customInstructions: rules.customInstructions.trim(),
    },
    update: {
      brandTone: rules.brandTone.trim(),
      titleRule: rules.titleRule.trim(),
      descriptionRule: rules.descriptionRule.trim(),
      tagsRule: rules.tagsRule.trim(),
      seoRule: rules.seoRule.trim(),
      customInstructions: rules.customInstructions.trim(),
    },
  });

  return resolveEffectiveAiRules({
    brandTone: record.brandTone ?? undefined,
    titleRule: record.titleRule ?? undefined,
    descriptionRule: record.descriptionRule ?? undefined,
    tagsRule: record.tagsRule ?? undefined,
    seoRule: record.seoRule ?? undefined,
    customInstructions: record.customInstructions ?? undefined,
  });
}

/**
 * Resets a store's AI generation rules back to the system defaults by deleting the custom row.
 */
export async function resetAiRulesForStore(
  accountId: string,
  storeId: string
): Promise<StoreAiRules> {
  await prisma.storeAiRule.deleteMany({
    where: {
      storeId,
      accountId,
    },
  });

  return { ...DEFAULT_AI_RULES };
}
