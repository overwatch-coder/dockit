"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import {
  deleteStore,
  disconnectStoreShopify,
  isShopDomainConnected,
  saveStoreAccessToken,
  saveStoreAppCredentials,
  unlinkStoreShopify,
} from "@/lib/db/stores";
import { ACTIVE_STORE_COOKIE_NAME } from "@/lib/active-store-cookie";
import {
  maskAccessToken,
  normalizeShopDomainInput,
  verifyShopDomain,
} from "@/lib/shopify/oauth";
import { fetchShopName } from "@/lib/shopify/shop";
import { triggerStoreImport } from "@/lib/jobs/import";
import {
  type StoreAiRules,
  storeAiRulesFormSchema,
} from "@/lib/ai/rules";
import {
  saveAiRulesForStore,
  resetAiRulesForStore,
} from "@/lib/db/ai-rules";

const idSchema = z.string().trim().min(1, "Missing store id.");
const shopDomainSchema = z
  .string()
  .trim()
  .min(1, "Enter your store's domain")
  .transform(normalizeShopDomainInput);

export async function saveAppCredentialsAction(input: {
  storeId: string;
  shopDomain: string;
  apiKey: string;
  apiSecret: string;
}): Promise<{ success: true; shopDomain: string } | { success: false; error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(input.storeId).success) {
    return { success: false, error: "Invalid store." };
  }

  const parsedDomain = shopDomainSchema.safeParse(input.shopDomain);
  if (!parsedDomain.success) {
    return { success: false, error: parsedDomain.error.issues[0]?.message ?? "Invalid shop domain." };
  }
  const shopDomain = parsedDomain.data;
  if (!verifyShopDomain(shopDomain)) {
    return { success: false, error: "Enter a valid myshopify.com store domain (e.g. your-store.myshopify.com)" };
  }

  const cleanApiKey = input.apiKey?.trim();
  const cleanApiSecret = input.apiSecret?.trim();
  if (!cleanApiKey || !cleanApiSecret) {
    return { success: false, error: "Both Client ID and Client Secret are required." };
  }

  if (await isShopDomainConnected(shopDomain, input.storeId)) {
    return { success: false, error: "This store domain is already connected to another store." };
  }

  try {
    await saveStoreAppCredentials({
      accountId: account.id,
      storeId: input.storeId,
      shopDomain,
      apiKey: cleanApiKey,
      apiSecret: cleanApiSecret,
    });
    revalidatePath("/", "layout");
    return { success: true, shopDomain };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save credentials.";
    return { success: false, error: message };
  }
}

export async function saveLegacyTokenAction(input: {
  storeId: string;
  shopDomain: string;
  accessToken: string;
}): Promise<
  | { success: true; shopDomain: string; tokenPreview: string }
  | { success: false; error: string }
> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(input.storeId).success) {
    return { success: false, error: "Invalid store." };
  }

  const parsedDomain = shopDomainSchema.safeParse(input.shopDomain);
  if (!parsedDomain.success) {
    return { success: false, error: parsedDomain.error.issues[0]?.message ?? "Invalid shop domain." };
  }
  const shopDomain = parsedDomain.data;
  if (!verifyShopDomain(shopDomain)) {
    return { success: false, error: "Enter a valid myshopify.com store domain (e.g. your-store.myshopify.com)" };
  }

  if (await isShopDomainConnected(shopDomain, input.storeId)) {
    return { success: false, error: "This store domain is already connected to another store." };
  }

  const cleanToken = input.accessToken?.trim();
  if (!cleanToken || cleanToken.length < 8) {
    return { success: false, error: "Please provide a valid Admin API Access Token." };
  }

  // Verify that the token works against Shopify
  const shopNameResult = await fetchShopName(shopDomain, cleanToken);
  if (!shopNameResult.success) {
    return {
      success: false,
      error: `Could not connect to Shopify: ${shopNameResult.error}. Verify your domain and token permissions.`,
    };
  }

  try {
    await saveStoreAccessToken({
      accountId: account.id,
      storeId: input.storeId,
      shopDomain,
      accessToken: cleanToken,
      name: shopNameResult.data.name,
    });

    // Trigger initial catalog sync in the background
    await triggerStoreImport({
      accountId: account.id,
      storeId: input.storeId,
      shopifyDomain: shopDomain,
    }).catch((err) => {
      console.error("saveLegacyTokenAction: triggerStoreImport error:", err);
    });

    revalidatePath("/", "layout");
    return {
      success: true,
      shopDomain,
      tokenPreview: maskAccessToken(cleanToken),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save token.";
    return { success: false, error: message };
  }
}

export async function disconnectStoreAction(input: {
  storeId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(input.storeId).success) {
    return { success: false, error: "Invalid store." };
  }

  try {
    await disconnectStoreShopify({
      accountId: account.id,
      storeId: input.storeId,
    });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect store.";
    return { success: false, error: message };
  }
}

export async function deleteStoreAction(input: {
  storeId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(input.storeId).success) {
    return { success: false, error: "Invalid store." };
  }

  try {
    const { deleted } = await deleteStore({
      accountId: account.id,
      storeId: input.storeId,
    });
    if (!deleted) {
      return { success: false, error: "Store not found or already deleted." };
    }

    const cookieStore = await cookies();
    if (cookieStore.get(ACTIVE_STORE_COOKIE_NAME)?.value === input.storeId) {
      cookieStore.delete(ACTIVE_STORE_COOKIE_NAME);
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete store.";
    return { success: false, error: message };
  }
}

export async function unlinkStoreAction(input: {
  storeId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(input.storeId).success) {
    return { success: false, error: "Invalid store." };
  }

  try {
    await unlinkStoreShopify({
      accountId: account.id,
      storeId: input.storeId,
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to unlink store.";
    return { success: false, error: message };
  }
}

export async function saveStoreAiRulesAction(input: {
  storeId: string;
  rules: StoreAiRules;
}): Promise<{ success: true; rules: StoreAiRules } | { success: false; error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(input.storeId).success) {
    return { success: false, error: "Invalid store." };
  }

  const parsedRules = storeAiRulesFormSchema.safeParse(input.rules);
  if (!parsedRules.success) {
    return {
      success: false,
      error: parsedRules.error.issues[0]?.message ?? "Invalid AI rules format.",
    };
  }

  try {
    const saved = await saveAiRulesForStore(account.id, input.storeId, parsedRules.data);
    revalidatePath("/settings");
    return { success: true, rules: saved };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save AI rules.";
    return { success: false, error: message };
  }
}

export async function resetStoreAiRulesAction(input: {
  storeId: string;
}): Promise<{ success: true; rules: StoreAiRules } | { success: false; error: string }> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(input.storeId).success) {
    return { success: false, error: "Invalid store." };
  }

  try {
    const reset = await resetAiRulesForStore(account.id, input.storeId);
    revalidatePath("/settings");
    return { success: true, rules: reset };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset AI rules.";
    return { success: false, error: message };
  }
}
